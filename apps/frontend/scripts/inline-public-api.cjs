// Metro does not provide esbuild's define. Inline only this public variable.
module.exports = ({ types: t }) => ({
  visitor: {
    MemberExpression(p) {
      if (p.matchesPattern('process.env.PUBLIC_API_BASE_URL'))
        p.replaceWith(
          process.env.PUBLIC_API_BASE_URL
            ? t.stringLiteral(process.env.PUBLIC_API_BASE_URL)
            : t.unaryExpression('void', t.numericLiteral(0)),
        );
    },
  },
});
