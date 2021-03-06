'use strict';

const { send } = require('micro');
const { toJSON, proccessHmac } = require('../utils');
const { Storage } = require('../storage');
const { Client } = require('../client');

const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const deployedURI = process.env.DEPLOYED_URI;

// eslint-disable-next-line consistent-return
exports.route = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204);
  }

  try {
    const { hmac, code, state } = req.query;
    const storageProvider = new Storage();
    const { store } = storageProvider;
    const clientProvider = new Client();
    const { client } = clientProvider;
    const secureParam = client.getSecureParam({
      params: req.query,
    });
    if (secureParam && hmac && code && state) {
      await store.setup();
      const credentials = await store
        .retrieveValue(secureParam, state)
        .then(() => proccessHmac({
          req,
          hmac,
          apiSecret,
        }))
        .then((validHmac) => {
          if (validHmac) {
            return client.generateAccessToken({
              secureParam,
              apiKey,
              apiSecret,
              code,
              deployedURI,
            });
          }
          return {};
        })
        .then(token => token);

      if (credentials.access_token) {
        return send(res, 200, credentials);
      }
      return send(res, 400, { error: 'Unable to validate2' });
    }
    return send(res, 400, { error: 'Required parameters missing' });
  } catch (error) {
    const jsonError = toJSON(error);
    return send(res, error.statusCode || 500, jsonError);
  }
};
