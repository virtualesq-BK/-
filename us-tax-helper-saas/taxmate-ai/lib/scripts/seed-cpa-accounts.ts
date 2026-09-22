/**
 * CPA 테스트 계정 생성
 *
 * Usage: npm run seed:cpa
 * Requires: DATABASE_URL
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const CPA_ACCOUNTS = [
  {
    email: 'cpa.alice@taxmate.test',
    name: 'Alice Johnson, CPA',
    cpaLicenseNumber: 'CPA-CA-12345',
    cpaFirmName: 'Johnson Tax Advisors',
    cpaBio: 'Specializing in freelancers and LLCs in California. 15 years experience.',
    cpaState: 'CA',
    cpaSpecialties: ['consulting', 'software development', 'design'],
    hourlyRate: 175,
    cpaRating: 4.9,
    cpaReviewCount: 128,
    cpaAvgResponseMin: 8,
    stripeConnectAccountId: 'acct_test_cpa_alice',
  },
  {
    email: 'cpa.bob@taxmate.test',
    name: 'Bob Martinez, CPA',
    cpaLicenseNumber: 'CPA-TX-67890',
    cpaFirmName: 'Lone Star Tax Partners',
    cpaBio: 'Texas-based CPA for 1099 contractors and rideshare drivers.',
    cpaState: 'TX',
    cpaSpecialties: ['rideshare', 'delivery', 'construction'],
    hourlyRate: 140,
    cpaRating: 4.7,
    cpaReviewCount: 89,
    cpaAvgResponseMin: 12,
    stripeConnectAccountId: 'acct_test_cpa_bob',
  },
  {
    email: 'cpa.carol@taxmate.test',
    name: 'Carol Chen, CPA',
    cpaLicenseNumber: 'CPA-NY-11223',
    cpaFirmName: 'Chen & Associates',
    cpaBio: 'NYC small business tax expert. S-Corp and partnership focus.',
    cpaState: 'NY',
    cpaSpecialties: ['retail', 'real estate', 'marketing'],
    hourlyRate: 195,
    cpaRating: 4.8,
    cpaReviewCount: 201,
    cpaAvgResponseMin: 10,
    stripeConnectAccountId: 'acct_test_cpa_carol',
  },
];

const TEST_USER = {
  email: 'user.demo@taxmate.test',
  name: 'Demo Freelancer',
  role: UserRole.USER,
};

async function main() {
  console.log('Seeding CPA test accounts...\n');

  for (const cpa of CPA_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: cpa.email },
      create: {
        email: cpa.email,
        name: cpa.name,
        role: UserRole.CPA,
        isVerified: true,
        cpaLicenseNumber: cpa.cpaLicenseNumber,
        cpaFirmName: cpa.cpaFirmName,
        cpaBio: cpa.cpaBio,
        cpaState: cpa.cpaState,
        cpaSpecialties: cpa.cpaSpecialties,
        hourlyRate: cpa.hourlyRate,
        cpaRating: cpa.cpaRating,
        cpaReviewCount: cpa.cpaReviewCount,
        cpaAvgResponseMin: cpa.cpaAvgResponseMin,
        stripeConnectAccountId: cpa.stripeConnectAccountId,
        emailVerified: new Date(),
      },
      update: {
        role: UserRole.CPA,
        isVerified: true,
        cpaLicenseNumber: cpa.cpaLicenseNumber,
        cpaFirmName: cpa.cpaFirmName,
        cpaBio: cpa.cpaBio,
        cpaState: cpa.cpaState,
        cpaSpecialties: cpa.cpaSpecialties,
        hourlyRate: cpa.hourlyRate,
        cpaRating: cpa.cpaRating,
        cpaReviewCount: cpa.cpaReviewCount,
        cpaAvgResponseMin: cpa.cpaAvgResponseMin,
        stripeConnectAccountId: cpa.stripeConnectAccountId,
      },
    });
    console.log(`  ✓ CPA: ${user.email} (${user.cpaState})`);
  }

  const demoUser = await prisma.user.upsert({
    where: { email: TEST_USER.email },
    create: {
      email: TEST_USER.email,
      name: TEST_USER.name,
      role: UserRole.USER,
      emailVerified: new Date(),
    },
    update: { name: TEST_USER.name },
  });

  const existingProfile = await prisma.businessProfile.findFirst({
    where: { userId: demoUser.id },
  });

  if (!existingProfile) {
    await prisma.businessProfile.create({
      data: {
        userId: demoUser.id,
        businessName: 'Demo Consulting LLC',
        businessType: 'LLC',
        industry: 'consulting',
        state: 'CA',
        city: 'San Francisco',
        address: '123 Market St',
        zipCode: '94105',
      },
    });
  } else {
    await prisma.businessProfile.update({
      where: { id: existingProfile.id },
      data: { industry: 'consulting', state: 'CA' },
    });
  }

  console.log(`  ✓ Demo user: ${demoUser.email}`);
  console.log('\n✅ Seed complete.');
  console.log('\nNote: Sign in with Google OAuth in dev, or link these emails to OAuth accounts.');
  console.log('To test CPA flow, manually set your user role to CPA in DB or use seeded emails with OAuth.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
