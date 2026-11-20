module.exports = function (api) {
  const localQa = api.cache.using(() => process.env.YJ_NEXO_LOCAL_QA === '1');
  const atlasRelease = api.cache.using(() => process.env.YJ_NEXO_ATLAS_QA_ANDROID_RELEASE === '1');
  const qaBaseUrl = atlasRelease ? 'https://yj-nexo-munierp-qa.onrender.com/api/v1' : '';
  return {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [({ types: t }) => ({
      visitor: {
        MemberExpression(path, state) {
          if (!/[\\/]src[\\/]constants[\\/]api-target\.js$/.test(state.filename || '')) return;
          if (path.matchesPattern('process.env.YJ_NEXO_LOCAL_QA')) {
            path.replaceWith(t.stringLiteral(localQa ? '1' : '0'));
          }
          if (path.matchesPattern('process.env.YJ_NEXO_BUNDLED_ANDROID_QA_URL')) {
            path.replaceWith(t.stringLiteral(qaBaseUrl));
          }
        },
      },
    })],
  };
};
