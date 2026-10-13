'use strict';

const cassette = require('./cassette');
const settings = require('./settings');
const matcher = require('./matcher');
const verdict = require('./verdict');
const loader = require('./loader');

module.exports = {
  ...cassette,
  ...settings,
  ...matcher,
  ...verdict,
  ...loader,
};
