const fs = require('fs');
const { promisify } = require('util');
const { CLIEngine } = require('eslint');
const glob = require('fast-glob');
const j = require('jscodeshift');

const asyncReadFile = promisify(fs.readFile);
const asyncWriteFile = promisify(fs.writeFile);

const dotRegexp = new RegExp(/\./, 'g');

async function transform() {
  const files = await glob('./src/**/*.test.js');

  files.forEach(transformMethod);
}

async function transformMethod(filePath) {
  const source = await asyncReadFile(filePath);

  const root = j(source.toString('utf-8'))
    .find(j.CallExpression)
    .filter(({ value: callExpression }) => {
      const { property } = callExpression.callee;

      return property && property.name === 'checkMetrics';
    })
    .forEach(({ value: callExpression }) => {
      const checkObjectPath = callExpression.arguments[0];
      const checkObject = parseObject(checkObjectPath);
      const attrsString = checkObject.attrs ? `[${attrsIntoString(checkObject.attrs)}]` : '';
      const path = `/${checkObject.path.replace(dotRegexp, '/')}${attrsString}`;

      // Remove `attrs` property from original object
      checkObjectPath.properties = checkObjectPath.properties.filter(({ key }) => key.name !== 'attrs');

      // Find AST representation of `path` property
      const counterPath = checkObjectPath.properties.find(({ key }) => key.name === 'path');

      counterPath.value.value = path;
    });

  // For code formatting, try to remove it for see result without it
  const linter = new CLIEngine({ fix: true });
  let newSource = root.toSource({ quote: 'single' });
  let eslintResult;

  try {
    [eslintResult] = linter.executeOnText(newSource, filePath).results;
  } catch (e) {
    console.log(e);
  }

  if (eslintResult.output) {
    newSource = eslintResult.output;
  }

  await asyncWriteFile(filePath, newSource, 'utf-8');
}

function parseObject(objectPath) {
  let i;

  // eval is evil, but not here :)
  eval(`i = ${j(objectPath).toSource()}`);

  return i;
}

function attrsIntoString(attrsObj, prefix = '') {
  const keys = Object.keys(attrsObj);

  return keys.reduce((str, key) => {
      if (str.length) {
          str += ' and ';
      }

      const val = attrsObj[key];

      if (typeof val === 'string') {
          if (val === '*') {
              str += `${prefix}@${key}`;
          } else {
              str += `${prefix}@${key}="${val}"`;
          }
      } else if (typeof val === 'number' || typeof val === 'boolean') {
          str += `${prefix}@${key}=${val}`;
      } else if (Array.isArray(val)) {
          str += val.reduce((acc, cur) => {
              if (acc.length) {
                  acc += ' and ';
              }

              acc += `${prefix}@${key} has "${cur}"`;

              return acc;
          }, '');
      } else {
          str += attrsIntoString(val, `${prefix}@${key}`);
      }

      return str;
  }, '');
}

transform();
