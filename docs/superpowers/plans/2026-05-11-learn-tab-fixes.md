# Learn Tab Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six confirmed bugs in the Learn tab: stale canvas state after ClearFlow, misleading server card label, clipped expanded panels, dead `LearnPan` message, zoom direction inversion, and empty-state layout default.

**Architecture:** All fixes are in the Elm layer (`devtools-ui/src/src/`). Tests live in `devtools-extension/tests/UpdateTests.elm` (Update logic) and a new `LearnViewTests.elm` file (pure view helpers). Each task is self-contained: write failing test → implement → pass → commit.

**Tech Stack:** Elm 0.19.1, elm-explorations/test 2.2.1, `elm make` (build), pnpm (workspace)

> **Running Elm tests:** The test suite is run from `packages/devtools-extension/` using the `elm test` binary that ships with the `devtools-extension` dependencies. Run with:
> ```bash
> cd packages/devtools-extension && npx elm test
> ```
> The Elm source files live in `packages/devtools-ui/src/src/` but are symlinked/referenced from the extension's `elm.json` source-directories. All four test files in `packages/devtools-extension/tests/` import from `Update`, `Helpers`, `Model`, and `Types` directly.

---

## File Map

| File | Action | Why |
|------|--------|-----|
| `packages/devtools-extension/tests/UpdateTests.elm` | Modify | Add tests for ClearFlow canvas reset, zoom direction |
| `packages/devtools-extension/tests/LearnViewTests.elm` | **Create** | Tests for pure helpers: `serverCardLabel`, `expandedPanelHeight` |
| `packages/devtools-ui/src/src/Update.elm` | Modify | Fix ClearFlow (reset learnCanvas), fix zoom direction, remove dead LearnPan, remove LearnEndPan |
| `packages/devtools-ui/src/src/LearnView.elm` | Modify | Fix server card label, fix expanded panel height, fix empty-state layout message |

---

## Task 1: Fix ClearFlow — reset `learnCanvas` state

**Problem:** `ClearFlow` in `Update.elm:124-141` never resets `model.learnCanvas`. After clearing, the canvas retains stale `learnSelectedNodeId`, `expandedCard`, `cardPositions`, `panX`, `panY`, and `zoom`. New events arrive but the canvas shows a phantom selected node.

**Files:**
- Modify: `packages/devtools-extension/tests/UpdateTests.elm`
- Modify: `packages/devtools-ui/src/src/Update.elm:124-141`

- [ ] **Step 1: Add failing tests to `UpdateTests.elm`**

Open `packages/devtools-extension/tests/UpdateTests.elm`. Find the `clearFlowTests` describe block and add two new test cases inside it (after the existing "resets all model state" test):

```elm
        , test "ClearFlow resets learnCanvas to initial state" <|
            \_ ->
                let
                    canvas =
                        initModel.learnCanvas

                    dirtyModel =
                        { initModel
                            | learnCanvas =
                                { canvas
                                    | learnSelectedNodeId = Just "node-1"
                                    , expandedCard = Just BrowserCard
                                    , cardPositions = [ ( "browser", { x = 50, y = 100 } ) ]
                                    , panX = 200
                                    , panY = 150
                                    , zoom = 2.5
                                }
                        }

                    ( model, _ ) =
                        update ClearFlow dirtyModel
                in
                Expect.all
                    [ \m -> Expect.equal Nothing m.learnCanvas.learnSelectedNodeId
                    , \m -> Expect.equal Nothing m.learnCanvas.expandedCard
                    , \m -> Expect.equal [] m.learnCanvas.cardPositions
                    , \m -> Expect.within (Expect.Absolute 0.001) 0.0 m.learnCanvas.panX
                    , \m -> Expect.within (Expect.Absolute 0.001) 0.0 m.learnCanvas.panY
                    , \m -> Expect.within (Expect.Absolute 0.001) 1.0 m.learnCanvas.zoom
                    ]
                    model
        , test "ClearFlow preserves learnCanvas dragTarget and isPanning as false" <|
            \_ ->
                let
                    canvas =
                        initModel.learnCanvas

                    dirtyModel =
                        { initModel
                            | learnCanvas =
                                { canvas
                                    | dragTarget = Just ServerCard
                                    , isPanning = True
                                }
                        }

                    ( model, _ ) =
                        update ClearFlow dirtyModel
                in
                Expect.all
                    [ \m -> Expect.equal Nothing m.learnCanvas.dragTarget
                    , \m -> Expect.equal False m.learnCanvas.isPanning
                    ]
                    model
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/devtools-extension && npx elm test tests/UpdateTests.elm
```

Expected: FAIL — the new tests fail because `ClearFlow` does not reset `learnCanvas`.

- [ ] **Step 3: Fix `ClearFlow` in `Update.elm`**

In `packages/devtools-ui/src/src/Update.elm`, find the `ClearFlow ->` branch (around line 125). Replace it:

```elm
        ClearFlow ->
            ( { model
                | events = []
                , eventsById = Dict.empty
                , selectedEventId = Nothing
                , flowId = Nothing
                , selectedNodeId = Nothing
                , expandedSubRows = Set.empty
                , isPlaying = False
                , playbackIndex = Nothing
                , importedFlow = Nothing
                , exportMenuOpen = False
                , recording = True
                , importPasteOpen = False
                , importPasteText = ""
                , learnCanvas =
                    { zoom = 1.0
                    , panX = 0.0
                    , panY = 0.0
                    , cardPositions = []
                    , expandedCard = Nothing
                    , dragTarget = Nothing
                    , dragStart = Nothing
                    , isPanning = False
                    , panStart = Nothing
                    , learnSelectedNodeId = Nothing
                    }
              }
            , Cmd.none
            )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/devtools-extension && npx elm test tests/UpdateTests.elm
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-ui/src/src/Update.elm packages/devtools-extension/tests/UpdateTests.elm
git commit -m "fix(learn): reset learnCanvas on ClearFlow"
```

---

## Task 2: Fix server card label — `"— OK"` when no response

**Problem:** In `LearnView.elm:661`, when `responseStatus` is `"—"` (no captured response) and `serverHasError` is false, the server card context line reads `"— OK"`. This looks like a valid status code when it means "no data".

**Files:**
- Modify: `packages/devtools-ui/src/src/LearnView.elm` (DaVinci layout, around line 661)
- Modify: `packages/devtools-ui/src/src/LearnView.elm` (Journey layout server card, around line 1014)

- [ ] **Step 1: Fix the DaVinci server card label**

In `packages/devtools-ui/src/src/LearnView.elm`, find the `renderCard ServerCard` call in `renderDaVinciCards` (around line 659–663). Change the context line expression:

**Before:**
```elm
    , renderCard ServerCard sx sy fW fH serverBorder "1" "" canvas.expandedCard
        (serverIcon (sx + 40) (sy + 15))
        "SERVER"
        (if serverHasError then "✕ " ++ responseStatus else responseStatus ++ " OK")
```

**After:**
```elm
    , renderCard ServerCard sx sy fW fH serverBorder "1" "" canvas.expandedCard
        (serverIcon (sx + 40) (sy + 15))
        "SERVER"
        (if noNetEvents then
            "No response"
         else if serverHasError then
            "✕ " ++ responseStatus
         else
            responseStatus ++ " OK"
        )
```

- [ ] **Step 2: Fix the Journey server card label**

In `renderJourneyCards` (around line 1014), find the `renderCard ServerCard` call. Change:

**Before:**
```elm
    , renderCard ServerCard sx sy fW fH serverBorder "1" "" canvas.expandedCard
        (serverIcon (sx + 40) (sy + 15))
        "AM SERVER"
        (if serverHasError then "✕ " ++ responseStatus else "Sends callbacks")
```

**After:**
```elm
    , renderCard ServerCard sx sy fW fH serverBorder "1" "" canvas.expandedCard
        (serverIcon (sx + 40) (sy + 15))
        "AM SERVER"
        (if noNetEvents then
            "No response"
         else if serverHasError then
            "✕ " ++ responseStatus
         else
            "Sends callbacks"
        )
```

- [ ] **Step 3: Verify the Elm build compiles cleanly**

```bash
cd packages/devtools-ui && node build.mjs
```

Expected: Build completes without errors, `dist/elm.js` updated.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools-ui/src/src/LearnView.elm
git commit -m "fix(learn): show 'No response' instead of '— OK' on server card"
```

---

## Task 3: Fix expanded panel clipping — dynamic height

**Problem:** In `LearnView.elm:1786`, the `foreignObject` height is hardcoded to `"120"`. SDK detail panels can render 6+ rows (status + node + interaction + error code + message + type), all clipped silently.

**Files:**
- Modify: `packages/devtools-ui/src/src/LearnView.elm` — `expandedPanel` function (~line 1780)

The approach: increase the height from `120` to `200`. This accommodates up to ~10 rows at ~18px each without needing dynamic measurement (which is impossible in Elm SVG without ports). `200` is still well within the card canvas area.

- [ ] **Step 1: Update `expandedPanel` height**

In `packages/devtools-ui/src/src/LearnView.elm`, find `expandedPanel` (around line 1780). Change the `SA.height` value:

**Before:**
```elm
expandedPanel : CardId -> Float -> Float -> Float -> Maybe CardId -> List (Html Msg) -> Svg Msg
expandedPanel cardId x y w expandedCard content =
    if expandedCard == Just cardId then
        Svg.foreignObject
            [ SA.x (String.fromFloat x)
            , SA.y (String.fromFloat y)
            , SA.width (String.fromFloat w)
            , SA.height "120"
            ]
```

**After:**
```elm
expandedPanel : CardId -> Float -> Float -> Float -> Maybe CardId -> List (Html Msg) -> Svg Msg
expandedPanel cardId x y w expandedCard content =
    if expandedCard == Just cardId then
        Svg.foreignObject
            [ SA.x (String.fromFloat x)
            , SA.y (String.fromFloat y)
            , SA.width (String.fromFloat w)
            , SA.height "200"
            ]
```

- [ ] **Step 2: Add `overflow-y: auto` to the expanded panel div**

In the same function, find the `Html.div` style list and add overflow:

**Before:**
```elm
            [ Html.div
                [ Html.Attributes.style "font-family" "'Segoe UI', system-ui, sans-serif"
                , Html.Attributes.style "font-size" "10px"
                , Html.Attributes.style "color" "#8b949e"
                , Html.Attributes.style "background" "#161B22"
                , Html.Attributes.style "border" "1px solid #30363d"
                , Html.Attributes.style "border-radius" "6px"
                , Html.Attributes.style "padding" "6px 8px"
                ]
                content
            ]
```

**After:**
```elm
            [ Html.div
                [ Html.Attributes.style "font-family" "'Segoe UI', system-ui, sans-serif"
                , Html.Attributes.style "font-size" "10px"
                , Html.Attributes.style "color" "#8b949e"
                , Html.Attributes.style "background" "#161B22"
                , Html.Attributes.style "border" "1px solid #30363d"
                , Html.Attributes.style "border-radius" "6px"
                , Html.Attributes.style "padding" "6px 8px"
                , Html.Attributes.style "max-height" "192px"
                , Html.Attributes.style "overflow-y" "auto"
                ]
                content
            ]
```

- [ ] **Step 3: Verify build compiles cleanly**

```bash
cd packages/devtools-ui && node build.mjs
```

Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools-ui/src/src/LearnView.elm
git commit -m "fix(learn): increase expanded panel height and add scroll for overflow"
```

---

## Task 4: Fix zoom direction inversion

**Problem:** In `Update.elm:537-547`, `LearnZoom delta` adds `deltaY` directly to zoom. `deltaY` is positive when scrolling down (conventional "zoom out"), but the formula zooms *in*. Conventional scroll behavior is: scroll down = zoom out.

**Files:**
- Modify: `packages/devtools-extension/tests/UpdateTests.elm`
- Modify: `packages/devtools-ui/src/src/Update.elm:537-547`

- [ ] **Step 1: Update existing zoom tests to assert correct direction**

The existing zoom tests in `UpdateTests.elm` test that `LearnZoom 100` results in zoom `1.1`. After the fix, `LearnZoom 100` (scroll down = zoom out) should result in zoom `0.9`. Update the existing `learnZoomTests` block:

```elm
learnZoomTests : Test
learnZoomTests =
    describe "Learn zoom interactions"
        [ test "LearnZoom with positive delta zooms out" <|
            \_ ->
                let
                    ( model, _ ) =
                        update (LearnZoom 100) initModel
                in
                Expect.within (Expect.Absolute 0.001) 0.9 model.learnCanvas.zoom
        , test "LearnZoom with negative delta zooms in" <|
            \_ ->
                let
                    ( model, _ ) =
                        update (LearnZoom -100) initModel
                in
                Expect.within (Expect.Absolute 0.001) 1.1 model.learnCanvas.zoom
        , test "LearnZoom clamps to minimum 0.5" <|
            \_ ->
                let
                    ( model, _ ) =
                        update (LearnZoom 10000) initModel
                in
                Expect.within (Expect.Absolute 0.001) 0.5 model.learnCanvas.zoom
        , test "LearnZoom clamps to maximum 3.0" <|
            \_ ->
                let
                    ( model, _ ) =
                        update (LearnZoom -10000) initModel
                in
                Expect.within (Expect.Absolute 0.001) 3.0 model.learnCanvas.zoom
        ]
```

- [ ] **Step 2: Run tests to verify the updated zoom tests now fail**

```bash
cd packages/devtools-extension && npx elm test tests/UpdateTests.elm
```

Expected: FAIL — `LearnZoom 100` still produces `1.1`, not `0.9`.

- [ ] **Step 3: Fix zoom direction in `Update.elm`**

Find `LearnZoom delta ->` in `packages/devtools-ui/src/src/Update.elm` (around line 537). Change:

**Before:**
```elm
        LearnZoom delta ->
            let
                canvas =
                    model.learnCanvas

                newZoom =
                    clamp 0.5 3.0 (canvas.zoom + delta * 0.001)
            in
            ( { model | learnCanvas = { canvas | zoom = newZoom } }
            , Cmd.none
            )
```

**After:**
```elm
        LearnZoom delta ->
            let
                canvas =
                    model.learnCanvas

                newZoom =
                    clamp 0.5 3.0 (canvas.zoom - delta * 0.001)
            in
            ( { model | learnCanvas = { canvas | zoom = newZoom } }
            , Cmd.none
            )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/devtools-extension && npx elm test tests/UpdateTests.elm
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-ui/src/src/Update.elm packages/devtools-extension/tests/UpdateTests.elm
git commit -m "fix(learn): invert zoom direction to match scroll convention"
```

---

## Task 5: Remove dead `LearnPan` / `LearnEndPan` message handlers

**Problem:** `LearnPan` and `LearnEndPan` are `Msg` constructors that are handled in `Update.elm` but never produced by any view code in `LearnView.elm`. The actual pan is driven by `LearnStartPan` + `LearnDrag` + `LearnEndDrag`. These dead handlers are confusing and add noise.

**Files:**
- Modify: `packages/devtools-ui/src/src/Update.elm`
- Modify: `packages/devtools-ui/src/src/Update.elm` — `Msg` type

- [ ] **Step 1: Remove `LearnPan` and `LearnEndPan` from the `Msg` type**

In `packages/devtools-ui/src/src/Update.elm`, find the `Msg` type declaration (around lines 10–54). Remove these two constructors:

```elm
    | LearnPan Float Float     -- REMOVE
    | LearnEndPan              -- REMOVE
```

The remaining learn-related constructors should be:
```elm
    | LearnSelectNode String
    | LearnExpandCard CardId
    | LearnCollapseCard
    | LearnStartDrag CardId Float Float
    | LearnDrag Float Float
    | LearnEndDrag
    | LearnStartPan Float Float
    | LearnZoom Float
```

- [ ] **Step 2: Remove the dead `LearnPan` and `LearnEndPan` case branches from `update`**

In the `update` function, find and delete both branches. The `LearnPan` branch is around line 494–520 and `LearnEndPan` is around lines 522–535:

```elm
        -- DELETE THIS ENTIRE BLOCK:
        LearnPan mx my ->
            let
                canvas =
                    model.learnCanvas
            in
            case canvas.panStart of
                Just start ->
                    let
                        dx =
                            mx - start.x

                        dy =
                            my - start.y
                    in
                    ( { model
                        | learnCanvas =
                            { canvas
                                | panX = canvas.panX + dx
                                , panY = canvas.panY + dy
                                , panStart = Just (Vec2 mx my)
                            }
                      }
                    , Cmd.none
                    )

                Nothing ->
                    ( model, Cmd.none )

        -- DELETE THIS ENTIRE BLOCK:
        LearnEndPan ->
            let
                canvas =
                    model.learnCanvas
            in
            ( { model
                | learnCanvas =
                    { canvas
                        | isPanning = False
                        , panStart = Nothing
                    }
              }
            , Cmd.none
            )
```

- [ ] **Step 3: Verify the Elm build compiles cleanly**

```bash
cd packages/devtools-ui && node build.mjs
```

Expected: Build completes without errors. If there is a compile error mentioning `LearnPan` or `LearnEndPan`, check that no view code references them (search `LearnView.elm` for those names — they should not appear).

- [ ] **Step 4: Run all tests to confirm nothing broken**

```bash
cd packages/devtools-extension && npx elm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/devtools-ui/src/src/Update.elm
git commit -m "fix(learn): remove dead LearnPan and LearnEndPan message handlers"
```

---

## Task 6: Fix empty-state layout default message

**Problem:** `detectLayout []` (no events) returns `DaVinciLayout`. The rail empty message then says "No DaVinci nodes recorded yet." — which is wrong if the user has just opened the Learn tab without any activity.

**Files:**
- Modify: `packages/devtools-ui/src/src/LearnView.elm` — `viewRail` empty message (around line 101-110) and `viewCanvas` empty message (around line 254-267)

- [ ] **Step 1: Fix the rail empty message**

In `packages/devtools-ui/src/src/LearnView.elm`, find `viewRail`. The `emptyMessage` computation is:

**Before:**
```elm
        emptyMessage =
            case layout of
                DaVinciLayout ->
                    "No DaVinci nodes recorded yet."

                JourneyLayout ->
                    "No Journey steps recorded yet."

                _ ->
                    "No OIDC events detected yet."
```

**After:**
```elm
        emptyMessage =
            if List.isEmpty nodes then
                "No auth events recorded yet."

            else
                case layout of
                    DaVinciLayout ->
                        "No DaVinci nodes recorded yet."

                    JourneyLayout ->
                        "No Journey steps recorded yet."

                    _ ->
                        "No OIDC events detected yet."
```

- [ ] **Step 2: Fix the canvas empty message**

Find `viewCanvas` (around line 251). The `Nothing` branch of `canvas.learnSelectedNodeId`:

**Before:**
```elm
        Nothing ->
            Html.div [ class "lv-canvas lv-canvas-empty" ]
                [ Html.text
                    (case layout of
                        DaVinciLayout ->
                            "Select a DaVinci node above to see its request lifecycle."

                        JourneyLayout ->
                            "Select a Journey step above to see its callback lifecycle."

                        _ ->
                            "Select an OIDC event above to see its details."
                    )
                ]
```

**After:**
```elm
        Nothing ->
            Html.div [ class "lv-canvas lv-canvas-empty" ]
                [ Html.text
                    (if List.isEmpty events then
                        "Record some auth activity, then select a node above."

                     else
                        case layout of
                            DaVinciLayout ->
                                "Select a DaVinci node above to see its request lifecycle."

                            JourneyLayout ->
                                "Select a Journey step above to see its callback lifecycle."

                            _ ->
                                "Select an OIDC event above to see its details."
                    )
                ]
```

- [ ] **Step 3: Verify build compiles cleanly**

```bash
cd packages/devtools-ui && node build.mjs
```

Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/devtools-ui/src/src/LearnView.elm
git commit -m "fix(learn): show neutral empty-state message before any events are recorded"
```

---

## Self-Review

**Spec coverage check:**

| Bug | Task | Covered? |
|-----|------|----------|
| #3 ClearFlow stale canvas | Task 1 | ✅ |
| #6 Server "— OK" label | Task 2 | ✅ |
| #7 Panel clipping (120px) | Task 3 | ✅ |
| #10 Zoom direction inverted | Task 4 | ✅ |
| #1 Dead LearnPan handlers | Task 5 | ✅ |
| #4 Empty state DaVinci default | Task 6 | ✅ |

**Placeholder scan:** None found. All code blocks are complete Elm.

**Type consistency check:**
- `CanvasState` fields used in Task 1 (`learnSelectedNodeId`, `expandedCard`, `cardPositions`, `panX`, `panY`, `zoom`, `dragTarget`, `isPanning`) all match `Types.elm:250-261`.
- `CardId` constructors used in tests (`BrowserCard`, `ServerCard`) match `Types.elm:225-235`.
- `Vec2` record `{ x : Float, y : Float }` matches `Types.elm:246-248`.
- `LearnPan` and `LearnEndPan` removals in Task 5: confirmed these constructors do not appear anywhere in `LearnView.elm`.
