# Config and plugins

## Config discovery

`desloppify` reads repo-local config from:

- `desloppify.config.json`
- `desloppify.config.cjs`
- `desloppify.config.js`
- `.desloppifyrc`
- `.desloppifyrc.json`
- `.desloppifyrc.cjs`
- `.desloppifyrc.js`

## Supported fields

- `extends`
- `plugins.<namespace>` for local JSON/module rule packs or installed package plugins
- `plugin:<namespace>/<config>` preset extends
- `rules.<id>.enabled`
- `rules.<id>.severity`
- `rules.<id>.weight`
- `rules.<id>.options.<name>` for plugin rule option values
- `overrides[].files`
- `overrides[].rules.<id>.enabled`
- `overrides[].rules.<id>.severity`
- `overrides[].rules.<id>.weight`
- `overrides[].rules.<id>.options.<name>`

## Example

```json
{
  "extends": ["./desloppify.base.json", "plugin:local/recommended"],
  "plugins": {
    "local": "./desloppify.plugin.cjs"
  },
  "rules": {
    "CONSOLE_LOG": { "enabled": false },
    "LONG_FILE": { "severity": "HIGH", "weight": 1.5 },
    "local/contains-token": {
      "options": {
        "token": "ACME",
        "replacement": "safeToken"
      }
    }
  },
  "overrides": [
    {
      "files": ["src/rules/**"],
      "rules": {
        "LONG_FILE": { "enabled": false },
        "local/contains-token": {
          "options": {
            "token": "RULE_TEST_TOKEN"
          }
        }
      }
    }
  ]
}
```

## Plugin example

```js
const { definePlugin, PLUGIN_API_VERSION } = require("desloppify/plugin-api")

module.exports = definePlugin({
  meta: {
    name: "local-plugin",
    namespace: "local",
    apiVersion: PLUGIN_API_VERSION
  },
  rules: [
    {
      id: "contains-token",
      category: "ai-slop",
      severity: "MEDIUM",
      message: "Contains {{token}}",
      description: "Contains {{token}} marker",
      fix: "Replace {{token}} with {{replacement}}",
      pattern: "{{token}}",
      files: ["src/**"],
      identityGroup: 0,
      options: {
        token: {
          type: "string",
          default: "ACME",
          description: "Token literal to flag"
        },
        replacement: {
          type: "string",
          default: "safeToken"
        }
      }
    }
  ],
  configs: {
    recommended: {
      rules: {
        "local/contains-token": {
          weight: 1.5,
          options: {
            token: "BETA"
          }
        }
      }
    }
  }
})
```

Packaged plugin example:

```json
{
  "plugins": { "acme": "desloppify-plugin-acme" },
  "extends": ["plugin:acme/recommended"]
}
```

## Programmatic API

Desloppify now exposes a stable root import for Bun/TS consumers:

```ts
import { scanProject, scanProjectSummary, summarizeScanReport, calculateScore, compareScanReports } from "desloppify"
```

Use the root import for supported programmatic scan/report work. Keep `desloppify/plugin-api` for plugin authoring. Do not rely on `desloppify/src/*` internals.

## Behavior notes

- plugin validation checks `apiVersion`, namespace mismatches, duplicate/non-local rule ids, and option default type mismatches
- plugin rule options are scalar values (`string`, `number`, `boolean`) resolved from rule defaults, then top-level config, then file overrides
- `{{optionName}}` placeholders can be used in plugin `pattern`, `flags`, `message`, `description`, `fix`, and `files`
- unknown plugin option names or type mismatches in config fail fast during plugin rule loading
- regex rules derive stable delta identities from match text or `identityGroup`
- plugin findings can attach `fix` text like built-in findings
- `scanProject(...)` returns the full canonical report; `scanProjectSummary(...)` returns the compact summary view
- `desloppify fix` also runs formatter cleanup passes when available:
  - JS/TS: `biome format`, `oxfmt`
  - Python: `ruff format`
