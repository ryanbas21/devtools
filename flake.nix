{
  description = "wolfcola-devtools development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs =
    {
      nixpkgs,
      systems,
      ...
    }:
    let
      eachSystem = nixpkgs.lib.genAttrs (import systems);
    in
    {
      devShells = eachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_24
              corepack
              lefthook
              elmPackages.elm
            ];

            shellHook = ''
              corepack enable --install-directory "$PWD/.corepack" >/dev/null 2>&1
              export PATH="$PWD/.corepack:$PATH"

              if [ ! -d node_modules ]; then
                echo "node_modules missing — running pnpm install..."
                pnpm install
              elif [ pnpm-lock.yaml -nt node_modules ]; then
                echo "pnpm-lock.yaml is newer than node_modules — running pnpm install..."
                pnpm install
              fi
            '';
          };
        }
      );

      formatter = eachSystem (system: nixpkgs.legacyPackages.${system}.nixfmt);
    };
}
