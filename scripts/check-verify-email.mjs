// The emailed "Verify Email" link, end to end in a browser.
//
// The welcome email links to /verify-email?token=… on the website. Until
// 7 Oct 2026 that page only read ?status= and never asked the API, so every
// emailed link said "Invalid link" and no account was ever verified
// (dead-ends audit 6 Oct 2026). This opens the link the way the email does
// and checks the account really becomes verified.
//
// Needs: local MongoDB, the API on :8001, the dev server on :3210.
// The API sends the browser back to FRONTEND_URL, which may be another local
// port; only the ?status= it lands on is read.
//   Run: node scripts/check-verify-email.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const WEB = process.env.APP_ORIGIN || 'http://localhost:3210';
const PY = 'backend/.venv/Scripts/python.exe';
const py = (code) => execFileSync(PY, ['-c', code], { cwd: '.', env: process.env }).toString().trim();
const prelude = `
import os,asyncio,hashlib,secrets,uuid,sys
from datetime import UTC,datetime,timedelta
sys.path.insert(0,'backend')
from dotenv import load_dotenv;load_dotenv('backend/.env')
assert any(h in os.environ['MONGO_URL'] for h in ('localhost','127.0.0.1')), 'local MongoDB only'
from motor.motor_asyncio import AsyncIOMotorClient
db=AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
`;
const seed = py(`${prelude}
async def m():
    await db.users.delete_many({'email':{'$regex':'^verify-check-.*@local.test$'}})
    out=[]
    for kind,exp in (('fresh',timedelta(hours=23)),('old',timedelta(hours=-1))):
        raw=secrets.token_urlsafe(32)
        await db.users.insert_one({'id':str(uuid.uuid4()),'email':f'verify-check-{kind}@local.test','name':'Verify Check','role':'renter','email_verified':False,
          'verification_token_hash':hashlib.sha256(raw.encode()).hexdigest(),'verification_token_expires_at':(datetime.now(UTC)+exp).isoformat()})
        out.append(raw)
    print(' '.join(out))
asyncio.run(m())`);
const [fresh, old] = seed.split(' ');

const failures = [];
const expect = (c, m) => { if (!c) failures.push(m); };
const b = await chromium.launch();
const p = await b.newPage();
async function follow(token) {
  await p.goto(`${WEB}/verify-email?token=${token}`);
  await p.waitForURL(/status=/, { timeout: 30000 });
  return new URL(p.url()).searchParams.get('status');
}
try {
  expect((await follow(fresh)) === 'success', 'a fresh emailed link verifies');
  expect((await follow(fresh)) === 'invalid', 'the same link cannot be used twice');
  expect((await follow(old)) === 'expired', 'an expired link says it has expired');
} finally {
  await b.close();
}
const flags = py(`${prelude}
async def m():
    rows={u['email'].split('-')[2].split('@')[0]:u.get('email_verified') async for u in db.users.find({'email':{'$regex':'^verify-check-'}})}
    await db.users.delete_many({'email':{'$regex':'^verify-check-.*@local.test$'}})
    print(rows.get('fresh'), rows.get('old'))
asyncio.run(m())`);
expect(flags === 'True False', `only the fresh link's account is verified (${flags})`);
if (failures.length) { console.log('FAIL\n- ' + failures.join('\n- ')); process.exitCode = 1; } else console.log('verify email: all passed');
