import { db } from './index';
import { members } from './schema';
import { eq } from 'drizzle-orm';

const SEED_MEMBERS = [
  { id: 'EMP001', name: 'Rajesh Kumar', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
  { id: 'EMP002', name: 'Priya Singh', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
  { id: 'EMP003', name: 'Amit Verma', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
  { id: 'EMP004', name: 'Sneha Reddy', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
  { id: 'EMP005', name: 'Vikram Joshi', join_date: '2024-09-01', policy_start_date: '2024-09-01' },
  { id: 'EMP006', name: 'Kavita Nair', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
  { id: 'EMP007', name: 'Suresh Patil', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
  { id: 'EMP008', name: 'Ravi Menon', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
  { id: 'EMP009', name: 'Anita Desai', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
  { id: 'EMP010', name: 'Deepak Shah', join_date: '2024-01-01', policy_start_date: '2024-01-01' },
];

export async function seedMembers() {
  for (const member of SEED_MEMBERS) {
    const existing = await db.select().from(members).where(eq(members.id, member.id)).get();
    if (!existing) {
      await db.insert(members).values({
        ...member,
        policy_id: 'PLUM_OPD_2024',
      }).run();
    }
  }
}

// Auto-seed on import
seedMembers();
