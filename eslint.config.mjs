import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Guard rail for the outage described in lib/billing/stage-payment.ts:
    // marking a stage fee `paid` must always also schedule generation for that
    // stage. Any code that writes `status: "paid"` outside lib/billing/ is
    // bypassing markStagePaid() and will silently strand the client's letters.
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
    ],
    ignores: ["lib/billing/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Only DB writes — `.insert()/.update()/.upsert()` argument objects.
          // A `status: "paid"` field in a JSON *response* body is fine.
          selector:
            "CallExpression[callee.property.name=/^(insert|update|upsert)$/] Property[key.name='status'][value.value='paid'], CallExpression[callee.property.name=/^(insert|update|upsert)$/] Property[key.value='status'][value.value='paid']",
          message:
            "Do not write status:'paid' to billing directly — use markStagePaid() from @/lib/billing/stage-payment so document generation is always triggered too.",
        },
      ],
    },
  },
]);

export default eslintConfig;
