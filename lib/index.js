'use strict';

const cassette = require('./cassette');
const settings = require('./settings');
const matcher = require('./matcher');
const verdict = require('./verdict');
const loader = require('./loader');
const replay = require('./replay');

module.exports = {
  ...cassette,
  ...settings,
  ...matcher,
  ...verdict,
  ...loader,
  ...replay,
};
