/// <reference types="node" />
import { expect, test, Page } from './render-fixture';
import { Buffer } from 'node:buffer';

async function login(page: Page, nickname = 'Alexis') {
  await page.addInitScript(() => localStorage.setItem('studyingToken', 'test-token'));
  await page.route('**/api/**', async route => {
    const url = route.request().url();
    let data: any = {};
    if (url.endsWith('/api/auth/me')) data = { user: { id: 'test-user', name: 'Alexis Test', email: 'test@example.com' } };
    else if (url.endsWith('/api/admin/me')) data = { isAdmin: false };
    else if (url.includes('/api/cappy/circles')) data = { sessions: [], discover: [], invitations: [] };
    else if (url.endsWith('/api/cappy/friends')) data = { code: 'AABBCCDDEE', friends: [], incoming: [], pending: [] };
    else if (url.endsWith('/api/chats')) data = { chats: [] };
    else data = { files: [], folders: [], flashcardSets: [], studyMaterials: [] };
    await route.fulfill({ json: data });
  });
  await page.goto('/');
  await expect(page.getByText(`Hello, ${nickname}!`, { exact: true })).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test('Monthly imports school-year activities after review and persists them on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.route('**/api/schedule/calendar', route => route.fulfill({ json: { activities: [{ title: 'Year-end exams', start: '2027-04-10', end: '2027-04-12', note: '' }], warnings: [] } }));
  await page.getByText('Week', { exact: true }).click();
  await page.getByRole('button', { name: 'Monthly', exact: true }).click();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload school calendar', exact: true }).click();
  await (await picker).setFiles({ name: 'school-year.txt', mimeType: 'text/plain', buffer: Buffer.from('Year-end exams April 10-12, 2027') });
  await expect(page.getByLabel('Activity 1 name', { exact: true })).toHaveValue('Year-end exams');
  await page.getByLabel('Activity 1 start (YYYY-MM-DD)', { exact: true }).fill('2027-02-30');
  await page.getByRole('button', { name: 'Add 1 activities to Monthly', exact: true }).click();
  await expect(page.getByText('Check every activity has a name and valid dates. End date must be on or after start date.')).toBeVisible();
  await page.getByLabel('Activity 1 start (YYYY-MM-DD)', { exact: true }).fill('2027-04-10');
  await page.getByRole('button', { name: 'Add 1 activities to Monthly', exact: true }).click();
  await expect(page.getByText(/1 activities added/)).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cappy-planner:test-user') || '{}'));
  expect(stored.activities[0]).toMatchObject({ title: 'Year-end exams', start: '2027-04-10', end: '2027-04-12' });
  await noOverflow(page);
  await page.reload();
  await page.getByText('Week', { exact: true }).click();
  await page.getByRole('button', { name: 'Monthly', exact: true }).click();
  for (let i = 0; i < 6; i++) await page.getByLabel('Next month', { exact: true }).click();
  await page.getByText('10', { exact: true }).click();
  await expect(page.getByText('Year-end exams', { exact: true })).toBeVisible();
});

test('branded loading screen fits a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => localStorage.setItem('studyingToken', 'test-token'));
  await page.route('**/api/auth/me', async route => { await new Promise(resolve => setTimeout(resolve, 2000)); await route.fulfill({ json: { user: { id: 'test-user', name: 'Alexis', email: 'test@example.com' } } }); });
  await page.route('**/api/admin/me', route => route.fulfill({ json: { isAdmin: false } }));
  await page.goto('/');
  await expect(page.getByLabel('STUDYante — A little more possible')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/studyante-loading-320.png' });
});

test('admin can check email readiness and request a user reset', async ({ page }) => {
  await login(page);
  await page.route('**/api/admin/me', route => route.fulfill({ json: { isAdmin: true } }));
  await page.route('**/api/admin/users', route => route.fulfill({ json: { users: [{ id: 'alice', name: 'Alice', email: 'alice@example.com', online: true, onlineSeconds: 300 }, { id: 'bob', name: 'Bob', email: 'bob@example.com', online: false, lastSeenAt: new Date(Date.now() - 300000).toISOString() }] } }));
  await page.route('**/api/admin/email-status', route => route.fulfill({ json: { ready: false, message: 'Email login failed. Check the sender account.' } }));
  let reset = false;
  await page.route('**/api/admin/users/alice/password-reset', route => { reset = true; return route.fulfill({ json: { success: true, message: 'Reset code sent to the account email.' } }); });
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await page.getByLabel('Open account settings', { exact: true }).click();
  await page.getByText('Open Admin Dashboard', { exact: true }).click();
  await page.getByText('Users', { exact: true }).click();
  await expect(page.getByText('● Online · 5 minutes', { exact: true })).toBeVisible();
  await expect(page.getByText('○ Offline · Last seen 5 minutes ago', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check reset email service' }).click();
  await expect(page.getByText('Email login failed. Check the sender account.')).toBeVisible();
  await page.getByRole('button', { name: 'Send password reset to Alice' }).click();
  await expect(page.getByText('Reset code sent to the account email.')).toBeVisible(); expect(reset).toBe(true);
});

test('forgot password requests a code and resets before returning to sign in', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => localStorage.setItem('cappy-onboarded', 'true'));
  let sent: any;
  await page.route('**/api/auth/forgot-password', route => route.fulfill({ json: { success: true } }));
  await page.route('**/api/auth/reset-password', route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { success: true } }); });
  await page.goto('/'); await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email address', { exact: true }).fill('test@example.com');
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page.getByLabel('Reset code', { exact: true })).toBeVisible();
  await page.getByLabel('Reset code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill('new-password');
  await page.getByLabel('Confirm new password', { exact: true }).fill('new-password');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Your fresh start is ready.')).toBeVisible();
  expect(sent).toEqual({ email: 'test@example.com', code: '123456', newPassword: 'new-password' });
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(page.getByText('Welcome back, friend', { exact: true })).toBeVisible(); await noOverflow(page);
});

test('missing live features show a useful availability message', async ({ page }) => {
  await login(page);
  await page.route('**/api/cappy/circles**', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<pre>Cannot GET /api/cappy/friends</pre>' }));
  await page.getByText('Circle', { exact: true }).click();
  await expect(page.getByText('This Circle action is missing from the server. The Circle backend needs to be updated.')).toBeVisible();
});

test('Cappy changes moods automatically with one mascot per feature', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 320, height: 740 }); await login(page);
  const mascot = page.getByRole('img', { name: 'Cappy the capybara study buddy' }).first();
  const original = await mascot.getAttribute('src');
  const sources: string[] = [];
  await expect(page.getByLabel('Cappy mood controls')).toHaveCount(0);
  for (const pose of ['read', 'dance', 'sleep', 'dance', 'cute', 'sad', 'mascot']) {
    await page.clock.fastForward(12000);
    await expect(mascot).toHaveAttribute('src', new RegExp(`cappy-${pose}`));
    sources.push((await mascot.getAttribute('src')) || ''); await noOverflow(page);
  }
  expect(new Set(sources).size).toBe(6);
  expect(sources[6]).toBe(original);
  for (const tab of ['To-dos', 'Week', 'Circle', 'Today']) {
    await page.getByText(tab, { exact: true }).last().click();
    await expect(page.getByRole('img', { name: 'Cappy the capybara study buddy' })).toHaveCount(1);
  }
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) test(`tapping sad Cappy makes it happy with ${reducedMotion} motion`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion }); await page.clock.install(); await login(page);
  const image = page.getByRole('img', { name: 'Cappy the capybara study buddy' });
  for (let i = 0; i < 6; i++) await page.clock.fastForward(12000);
  await expect(image).toHaveAttribute('src', /cappy-sad/);
  await expect(page.getByText('Tap to cheer Cappy up ♡')).toBeVisible();
  await page.getByRole('button', { name: 'Cheer Cappy up', exact: true }).click();
  await expect(image).toHaveAttribute('src', /cappy-dance/);
  await expect(page.getByText('You made my day! ♡')).toBeVisible();
  await expect(page.getByText('Tap to cheer Cappy up ♡')).toHaveCount(0);
  await page.clock.fastForward(10000);
  await expect(image).toHaveAttribute('src', /cappy-dance/);
  await page.clock.fastForward(2000);
  await expect(image).toHaveAttribute('src', /cappy-cute/);
});

test('class times support noon, midnight, PM and persistence', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await login(page);
  await page.getByText('Week', { exact: true }).click();
  await page.getByRole('button', { name: '＋ Add class', exact: true }).click();
  await page.getByLabel('Subject name', { exact: true }).fill('Afternoon art');
  await page.getByLabel('Start time', { exact: true }).fill('12:00');
  await page.getByRole('button', { name: 'Start time PM', exact: true }).click();
  await page.getByLabel('End time', { exact: true }).fill('1:30');
  await page.getByRole('button', { name: 'End time PM', exact: true }).click();
  await page.getByRole('button', { name: 'Save class', exact: true }).click();
  await expect(page.getByText('12:00 PM–1:30 PM', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '＋ Add class', exact: true }).click();
  await page.getByLabel('Subject name', { exact: true }).fill('Midnight astronomy');
  await page.getByLabel('Start time', { exact: true }).fill('12:00');
  await page.getByLabel('End time', { exact: true }).fill('1:00');
  await page.getByRole('button', { name: 'Save class', exact: true }).click();
  await expect(page.getByText('12:00 AM–1:00 AM', { exact: true })).toBeVisible();
  await page.reload(); await page.getByText('Week', { exact: true }).click();
  await expect(page.getByText('12:00 PM–1:30 PM', { exact: true })).toBeVisible();
  await noOverflow(page);
});

test('planner captures a camera image and closes its preview', async ({ page }) => {
  await login(page); await page.getByText('Week', { exact: true }).click();
  await page.getByRole('button', { name: /Take photo/ }).click();
  await expect(page.locator('video')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Capture schedule', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Capture schedule', exact: true }).click();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Let Cappy read it/ })).toBeVisible();
});

test('planner offers an image when camera access is denied', async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
  await login(page); await page.getByText('Week', { exact: true }).click();
  await page.getByRole('button', { name: /Take photo/ }).click();
  await expect(page.getByText(/Could not open the camera/)).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Choose image/ }).click();
  expect((await chooser).isMultiple()).toBe(false);
});
test('Cappy onboarding matches the setup flow and stores choices', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await page.goto('/');
  await expect(page.getByText('A lighter day starts here.')).toBeVisible();
  await page.getByRole('button', { name: 'Let’s get started' }).click();
  await page.getByLabel('Your nickname', { exact: true }).fill('Lex');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, add a class' }).click();
  await page.getByLabel('Subject name', { exact: true }).fill('Math');
  await page.getByRole('button', { name: 'Save class' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Cappy’s class reminders')).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Meet your study space' }).click();
  await expect(page.getByText('Welcome back, friend')).toBeVisible();
  await noOverflow(page);
  await login(page, 'Lex');
  await page.getByText('Week', { exact: true }).click();
  await expect(page.getByText('Math', { exact: true })).toBeVisible();
});
test('tasks, allowance and grades save across reloads', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await login(page);
  await page.getByRole('button', { name: 'Check in for today' }).click();
  await expect(page.getByText('✦ 1 day streak')).toBeVisible();
  await page.getByText('To-dos', { exact: true }).click();
  await page.getByRole('button', { name: '＋ Add task or event' }).click();
  await page.getByLabel('Task or event title', { exact: true }).fill('Review biology');
  await page.getByLabel('Deadline YYYY-MM-DD (optional)', { exact: true }).fill('2026-10-12');
  await page.getByRole('button', { name: 'Save task' }).click();
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('Review biology', { exact: true })).toBeVisible();
  await page.getByText('Today', { exact: true }).click();
  await page.getByText('Pocket Plan', { exact: true }).click();
  await page.getByLabel('Description', { exact: true }).fill('Weekly allowance');
  await page.getByLabel('Amount in pesos', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('₱500.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expense', exact: true }).click();
  await page.getByLabel('Description', { exact: true }).fill('Lunch');
  await page.getByLabel('Amount in pesos', { exact: true }).fill('70');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByText('₱430.00', { exact: true })).toBeVisible();
  await page.getByText('Today', { exact: true }).click();
  await page.getByRole('button', { name: 'Progress Pages', exact: true }).click();
  await page.getByLabel('Subject name', { exact: true }).fill('Biology');
  await page.getByRole('button', { name: '＋ Add subject' }).click();
  await page.getByRole('button', { name: '＋ Add activity score' }).click();
  await page.getByLabel('Activity or assessment', { exact: true }).fill('Quiz');
  await page.getByLabel('Points earned', { exact: true }).fill('18');
  await page.getByLabel('Total possible points', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Save score' }).click();
  await expect(page.getByText('90.0%', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('₱430.00 left', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Progress Pages', exact: true }).click();
  await expect(page.getByText('90.0%', { exact: true })).toBeVisible();
  await noOverflow(page);
});
for (const width of [320, 390, 768, 1024]) test(`main screens fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await login(page); await noOverflow(page);
  await page.screenshot({ path: `test-results/cappy-home-${width}.png`, fullPage: true });
  for (const tab of ['To-dos', 'Week', 'Desk', 'Circle', 'Today']) {
    await page.getByText(tab, { exact: true }).last().click(); await noOverflow(page);
  }
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(page.getByText('STUDYante AI', { exact: true }).first()).toBeVisible();
  await noOverflow(page);
  await expect(page.getByLabel('Send message', { exact: true })).toBeVisible();
  const sendBounds = await page.getByLabel('Send message', { exact: true }).boundingBox();
  expect(sendBounds!.x + sendBounds!.width).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `test-results/cappy-${width}.png`, fullPage: true });
});

for (const width of [320, 390, 768, 1024]) test(`admin controls fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await login(page);
  await page.route('**/api/admin/me', route => route.fulfill({ json: { isAdmin: true } }));
  await page.route('**/api/admin/users', route => route.fulfill({ json: { users: [{ id: 'alice', name: 'Alexandria Student', email: 'alexandria.student.with.a.long.email@example.com', online: true, onlineSeconds: 7200 }, { id: 'bob', name: 'Bob', email: 'bob@example.com', online: false, lastSeenAt: new Date(Date.now() - 300000).toISOString() }] } }));
  await page.reload();
  await page.getByLabel('Open account settings', { exact: true }).click();
  await page.getByText('Open Admin Dashboard', { exact: true }).click();
  await page.getByText('Users', { exact: true }).click();
  await expect(page.getByText(/Online · 2 hours/)).toBeVisible(); await noOverflow(page);
  for (const name of ['Check reset email service', 'Send password reset to Alexandria Student']) {
    const bounds = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width); expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: `test-results/admin-${width}.png`, fullPage: true });
});
test('schedule supports adding a class, monthly exceptions and export', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page);
  await page.getByText('Week', { exact: true }).click();
  await page.getByRole('button', { name: '＋ Add class', exact: true }).click();
  await page.getByLabel('Subject name', { exact: true }).fill('Algorithms');
  await page.getByRole('button', { name: 'Save class', exact: true }).click();
  await expect(page.getByText('Algorithms', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Monthly', exact: true }).click();
  await page.getByRole('button', { name: 'Mark this date as no class' }).click();
  await expect(page.getByText('Marked as no class.')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export schedule' }).click();
  expect((await download).suggestedFilename()).toBe('cappy-schedule.txt');
  await page.reload();
  await page.getByText('Week', { exact: true }).click();
  await expect(page.getByText('Algorithms', { exact: true })).toBeVisible();
});
test('schedule photos create editable drafts and save only after review', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await login(page);
  await page.route('**/api/schedule/scan', route => route.fulfill({ json: { classes: [{ name: 'Photo Math', day: 1, start: '09:00', end: '10:00', room: '101', note: '' }, { name: 'Photo Physics', day: null, start: '', end: '', room: '', note: 'Time was unclear.' }], warnings: ['Please verify the second meeting.'] } }));
  await page.getByRole('button', { name: 'Snap & Sort', exact: true }).click();
  await page.getByLabel('Choose schedule photo').setInputFiles({ name: 'schedule.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Let Cappy read it' }).click();
  await expect(page.getByText('Check Cappy’s draft')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to my week' })).toBeDisabled();
  await page.getByLabel('Wed for draft 2').click();
  await page.getByLabel('Start time 2', { exact: true }).fill('1:00');
  await page.getByRole('button', { name: 'Start time 2 PM', exact: true }).click();
  await page.getByLabel('End time 2', { exact: true }).fill('2:00');
  await page.getByRole('button', { name: 'End time 2 PM', exact: true }).click();
  await page.getByLabel('Subject 2', { exact: true }).fill('Physics corrected');
  await page.getByRole('button', { name: 'Add to my week' }).click();
  await expect(page.getByText('Photo Math', { exact: true })).toBeVisible();
  await expect(page.getByText('Physics corrected', { exact: true })).toBeVisible();
  await page.reload(); await page.getByText('Week', { exact: true }).click();
  await expect(page.getByText('Physics corrected', { exact: true })).toBeVisible();
  await noOverflow(page);
});
test('Cappy responds to touch and remains still with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page);
  const mascot = page.getByLabel('Cappy the capybara study buddy').first();
  const before = await mascot.evaluate(element => getComputedStyle(element).transform);
  await page.waitForTimeout(500);
  expect(await mascot.evaluate(element => getComputedStyle(element).transform)).toBe(before);
  await page.getByRole('button', { name: 'Say hello to Cappy' }).first().click();
  await expect(page.getByText('You’ve got this! ✦')).toBeVisible();
});
test('Cappy moves when motion is enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await login(page);
  const mascot = page.getByLabel('Cappy the capybara study buddy').first();
  const before = await mascot.evaluate(element => getComputedStyle(element).transform);
  await page.waitForTimeout(700);
  expect(await mascot.evaluate(element => getComputedStyle(element).transform)).not.toBe(before);
});

test('AI accepts document uploads separately from photos',async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page);await page.getByRole('button',{name:'Ask AI',exact:true}).click();
  for(const [name,mime,content] of [['lesson.txt','text/plain','Queues keep items in order.'],['lesson.pdf','application/pdf','%PDF-1.4 test fixture']]){
    await page.getByLabel('Open AI actions',{exact:true}).click();await expect(page.getByText('Choose photo',{exact:true})).toBeVisible();const chooserPromise=page.waitForEvent('filechooser');await page.getByText('Upload document',{exact:true}).click();const chooser=await chooserPromise;await chooser.setFiles({name,mimeType:mime,buffer:Buffer.from(content)});
    const request=page.waitForRequest(r=>r.url().endsWith('/api/chat') && r.method()==='POST');await page.route('**/api/chat',async route=>{const body=route.request().postDataBuffer()?.toString() || '';expect(body).toContain('name="file"');expect(body).toContain(name);expect(body).toContain(content);await route.fulfill({json:{chatId:'ai-test',answer:'Your lesson is ready.'}});});await page.getByLabel('Send message',{exact:true}).click();await request;await expect(page.getByText('Your lesson is ready.',{exact:true}).last()).toBeVisible();await noOverflow(page);
  }
  await expect(page.getByText('Unsupported FormDataPart implementation',{exact:true})).toHaveCount(0);
});
