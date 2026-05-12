type ElmPagesInit = {
  load: (elmLoaded: Promise<unknown>) => Promise<void>;
  flags: unknown;
};

const config: ElmPagesInit = {
  load: async function (elmLoaded) {
    const app = await elmLoaded;
    console.log('App loaded', app);
  },
  flags: function () {
    return {
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    };
  },
};

export default config;
