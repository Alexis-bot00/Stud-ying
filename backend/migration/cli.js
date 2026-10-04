import fs from 'node:fs/promises';
import path from 'node:path';
import { buildMigrationPlan, executeMigration } from './plan.js';
import { createRepository } from '../storage/repository.js';

const args = process.argv.slice(2);
function value(flag) { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; }
async function main() {
  const allowed = new Set(['--source','--report','--dry-run','--apply','--allow-network']);
  for (let i=0;i<args.length;i++) { if (!allowed.has(args[i])) throw new Error('Unknown argument'); if (['--source','--report'].includes(args[i])) { if (!args[++i] || args[i].startsWith('--')) throw new Error('Missing argument'); } }
  const source = value('--source'), reportPath = value('--report');
  if (!source || !reportPath) throw new Error('Use --source <library-directory> --report <private-report-path> --dry-run');
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Choose apply OR dry-run');
  const apply = args.includes('--apply');
  if (apply && !args.includes('--allow-network')) throw new Error('Apply requires explicit --allow-network');
  const resolvedReport = path.resolve(reportPath);
  // Never place private payload reports in the repository or source backup.
  const repo = path.resolve(import.meta.dirname, '../..'), sourceRoot = path.resolve(source);
  for (const prohibited of [repo, sourceRoot]) if (resolvedReport === prohibited || resolvedReport.startsWith(prohibited + path.sep)) throw new Error('Report must be outside Git and source library');
  const plan = await buildMigrationPlan(source);
  await fs.mkdir(path.dirname(resolvedReport), { recursive: true });
  // Exclusive creation: do not overwrite reports or any backup file.
  const report = { result: { state: 'planned' }, bundle: plan.bundle, objects: plan.objects, issues: plan.issues };
  await fs.writeFile(resolvedReport, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  let result;
  try {
    result = apply
      ? await executeMigration(plan, createRepository({ allowNetwork: true }), { dryRun: false })
      : { dryRun: true, counts: plan.bundle.report.counts, plannedObjects: plan.objects.length, unresolvedIssues: plan.issues.length };
  } catch {
    report.result = { state: 'failed', migrated: 0, failed: 1, databaseTransaction: 'not committed or outcome unconfirmed; rerun is idempotent', storage: 'some content-addressed objects may already exist; do not delete them' };
    await fs.writeFile(resolvedReport, JSON.stringify(report, null, 2), { mode: 0o600 });
    throw new Error('Import failed');
  }
  report.result = result;
  await fs.writeFile(resolvedReport, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ...result, failed: plan.issues.length }));
  if (plan.issues.length) process.exitCode = 2;
}
main().catch(() => { console.error('Migration failed; no secret values or record contents are logged. Check arguments, private report and source validation.'); process.exitCode = 1; });
