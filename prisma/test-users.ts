import type { UserRole } from "../app/generated/prisma/client";

export type TestUserSeed = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
};

export const testUsers: TestUserSeed[] = [
  {
    email: "admin@university.edu",
    password: "Admin@12345",
    name: "Admin User",
    role: "GAA",
  },
  {
    email: "officer@university.edu",
    password: "Officer@12345",
    name: "Evaluating Officer",
    role: "EVALUATING_OFFICER",
  },
  {
    email: "phi@university.edu",
    password: "Phi@12345",
    name: "PHI Inspector",
    role: "PHI",
  },
  {
    email: "admin.officer@university.edu",
    password: "AdminOff@12345",
    name: "Administration Officer",
    role: "ADMINISTRATION_OFFICER",
  },
  {
    email: "vc@university.edu",
    password: "VC@12345",
    name: "Vice Chancellor",
    role: "VICE_CHANCELLOR",
  },
];
