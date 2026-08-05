// Triage config
// TODO: Move to server and DB

export interface TriageConfig {
  // Your account name
  me: string;
  // Core team account names
  teamMembers: string[];
  // Trusted external contributor account names
  trustedContributors: string[];
  // Bot account names
  bots: string[];
  // Items created within this many hours land in the New bucket
  newWithinHours: number;
}

export const CONFIG: TriageConfig = {
  me: "USERNAME",

  teamMembers: [],

  trustedContributors: [],

  bots: [],

  newWithinHours: 24,
};
