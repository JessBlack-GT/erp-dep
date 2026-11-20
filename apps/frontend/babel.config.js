module.exports = function (api) {
  const localQA = api.cache.using(() => process.env.YJ_NEXO_LOCAL_QA === '1');
  return {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [({ types: t }) => ({
      visitor: {
        MemberExpression(path, state) {
          // Only replace our opt-in flag in the ERP API client, not in dependencies.
          if (/[\\/]src[\\/]services[\\/]api\.js$/.test(state.filename || '') &&
              path.matchesPattern('process.env.YJ_NEXO_LOCAL_QA')) {
            path.replaceWith(t.stringLiteral(localQA ? '1' : '0'));
          }
        },
      },
    })],
  };
};
