import { defineRailway, project, service } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "desapego";

export default defineRailway(() => {
  const desapego = service("desapego", {
    build: {
      builder: "RAILPACK",
      buildCommand: "npm run build",
      buildEnvironment: "V3",
    },
    start: "npm run start",
    healthcheck: "/",
    healthcheckTimeout: 60,
    // Region selection is a Pro-plan feature; on Hobby this is read back as the
    // default and cannot be moved closer to Brazil. Kept explicit so the plan
    // stays empty rather than drifting.
    replicas: { sfo: 1 },
    domains: [{ domain: "desapego.festivaldesapeguese.com.br", port: 3000 }],
  });

  return project("desapego", {
    // PORT stays a Railway variable rather than living here, so that future
    // secrets (database URL, auth keys) are not forced into source control.
    variables: { managed: false },
    resources: [desapego],
  });
});
