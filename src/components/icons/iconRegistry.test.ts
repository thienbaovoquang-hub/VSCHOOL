import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SUPER_APP_ICONS,
  SCHOOLHUB_APP_ICONS,
  SchoolHubLogoIcon,
} from './SchoolHubIcons';
import * as UiIcons from './UiIcons';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../../data/appRegistry';
import { TAB_ICONS } from '../shared/AppWindowShell';

const CORE_20_UI_ICON_NAMES = [
  'Home',
  'Search',
  'Filter',
  'Plus',
  'Pencil',
  'Trash2',
  'Calendar',
  'Clock',
  'MapPin',
  'MessageSquare',
  'User',
  'Settings',
  'Download',
  'Upload',
  'Printer',
  'Link2',
  'ShieldCheck',
  'Star',
  'Heart',
  'MoreHorizontal',
] as const;

test('all 10 super app icons render glossy gradient squircles matching SUPER_APP_ORDER', () => {
  for (const appId of SUPER_APP_ORDER) {
    const IconComp = SUPER_APP_ICONS[appId];
    assert.ok(IconComp, `Missing SUPER_APP_ICONS entry for ${appId}`);
    assert.equal(APP_REGISTRY[appId].icon, IconComp, `APP_REGISTRY[${appId}].icon mismatch`);

    const markup = renderToStaticMarkup(React.createElement(IconComp));
    assert.match(markup, /^<svg\b/, `${appId} should render an <svg>`);
    assert.match(markup, /<linearGradient\b/, `${appId} should use glossy linearGradient`);
    assert.match(markup, /rx="24"/, `${appId} should use rounded squircle rx="24"`);
    assert.match(markup, /#FFFFFF/i, `${appId} should render crisp white foreground glyph`);
  }

  const logoMarkup = renderToStaticMarkup(React.createElement(SchoolHubLogoIcon));
  assert.match(logoMarkup, /<linearGradient\b/);
  assert.match(logoMarkup, /rx="24"/);
});

test('all legacy module icons in SCHOOLHUB_APP_ICONS render glossy gradient squircles', () => {
  const keys = Object.keys(SCHOOLHUB_APP_ICONS);
  assert.ok(keys.length >= 15);
  for (const key of keys) {
    const IconComp = SCHOOLHUB_APP_ICONS[key];
    const markup = renderToStaticMarkup(React.createElement(IconComp));
    assert.match(markup, /^<svg\b/, `SCHOOLHUB_APP_ICONS.${key} must render svg`);
    assert.match(markup, /<linearGradient\b/, `SCHOOLHUB_APP_ICONS.${key} must use gradient squircle`);
  }
});

test('two instances of the same glossy app icon do not collide on gradient IDs', () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(SUPER_APP_ICONS.admin),
      React.createElement(SUPER_APP_ICONS.admin)
    )
  );
  const ids = Array.from(markup.matchAll(/id="([^"]+)"/g)).map((m) => m[1]);
  assert.ok(ids.length >= 8);
  assert.equal(new Set(ids).size, ids.length, 'SVG <defs> IDs must be unique across instances');
});

test('all 20 canonical UI icons render clean rounded-stroke SVGs', () => {
  for (const name of CORE_20_UI_ICON_NAMES) {
    const IconComp = UiIcons[name];
    assert.ok(IconComp, `Missing UiIcons.${name}`);
    const markup = renderToStaticMarkup(React.createElement(IconComp, { className: 'w-4 h-4' }));
    assert.match(markup, /^<svg\b/, `${name} must render svg`);
    assert.match(markup, /viewBox="0 0 24 24"/, `${name} must use 24x24 viewBox`);
    assert.match(markup, /stroke-linecap="round"|strokeLinecap="round"/);
    assert.match(markup, /stroke-linejoin="round"|strokeLinejoin="round"/);
    assert.match(markup, /ui-line-icon/);
  }
});

test('every tab iconName in APP_REGISTRY resolves in TAB_ICONS', () => {
  for (const appId of SUPER_APP_ORDER) {
    const meta = APP_REGISTRY[appId];
    for (const tab of meta.tabs) {
      const TabIcon = TAB_ICONS[tab.iconName];
      assert.ok(TabIcon, `Missing TAB_ICONS.${tab.iconName} for ${appId}.${tab.id}`);
      const markup = renderToStaticMarkup(React.createElement(TabIcon, { className: 'w-4 h-4' }));
      assert.match(markup, /^<svg\b/, `TAB_ICONS.${tab.iconName} failed to render svg`);
    }
  }
});
