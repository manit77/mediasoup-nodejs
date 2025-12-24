const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@client': path.resolve(__dirname, 'src'),
    },
  },
};