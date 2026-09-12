const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load the production TypeScript modules with the app's alias, without a browser.
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.join(__dirname, '../src', name.slice(2)) : name, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, filename);
const { analyzeBox } = require('../src/lib/freshness.ts');
const { planMeals } = require('../src/lib/recipes.ts');

function box(foodType, score, status) {
  return { id: foodType, name: foodType, foodType, elapsedHours: 1, lidOpen: false,
    sensors: { temperature: 28, humidity: 60, co2Ppm: 700, gasPpm: 0 },
    freshness: { score, status, reasons: ['Backend assessment'] } };
}

test('stored food uses the exact backend score despite warm sensor values', () => {
  const result = analyzeBox(box('tomato', 76.3, 'fresh'));
  assert.equal(result.score, 76.3);
  assert.equal(result.verdict, 'safe');
  assert.deepEqual(result.reasons, ['Backend assessment']);
});

test('three demo foods provide recipes with explicit replacements when declining', () => {
  const foods = ['strawberry', 'tomato', 'salad'].map(type => box(type, 12.3, 'declining'));
  const plan = planMeals(foods);
  assert.equal(plan.cookQueue.length, 0);
  assert.equal(plan.discard.length, 3);
  assert.ok(plan.meals.length >= 4);
  assert.ok(plan.meals.every(meal => meal.replacements.length > 0));
});

test('fresh foods produce ordinary recipes and an empty fridge produces none', () => {
  assert.equal(planMeals([]).meals.length, 0);
  const plan = planMeals([box('strawberry', 90, 'fresh')]);
  assert.equal(plan.meals.length, 2);
  assert.ok(plan.meals.every(meal => meal.replacements.length === 0));
});
