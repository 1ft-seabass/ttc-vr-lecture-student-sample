const path = require('path');

module.exports = {
  flowFile: 'flows.json',

  // フローエディタ(管理画面)は/adminへ移動する。
  // デフォルトのままだとhttpStaticのルート('/')と衝突し、
  // '/'にアクセスした際にBabylon.jsページではなく編集画面が表示されてしまうため。
  httpAdminRoot: '/admin',

  // publicフォルダをNode-RED自身のHTTPサーバーから'/'配下に静的配信する
  httpStatic: path.join(__dirname, '..', 'public'),

  logging: {
    console: {
      level: 'info',
      metrics: false,
      audit: false,
    },
  },

  editorTheme: {
    projects: {
      enabled: false,
    },
  },
};
