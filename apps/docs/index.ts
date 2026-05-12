import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-elm';
import 'prismjs/components/prism-javascript';

type ElmPagesInit = {
  load: (elmLoaded: Promise<unknown>) => Promise<void>;
  flags: unknown;
};

const config: ElmPagesInit = {
  load: async function (elmLoaded) {
    const app = await elmLoaded;
    console.log('App loaded', app);

    // Highlight code blocks after elm-pages renders each page
    const observer = new MutationObserver(() => {
      Prism.highlightAll();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },
  flags: function () {
    return {
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    };
  },
};

export default config;
