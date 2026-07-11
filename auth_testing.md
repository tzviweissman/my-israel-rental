# Auth-Gated App Testing Playbook (Emergent Google Auth)

Save this file next to any Google-auth work so the testing agent can
follow the exact steps without needing external docs.

## Step 1: Create Test User & Session

```bash
mongosh --eval "
use('$DB_NAME');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API

```bash
# Auth endpoint
curl -X GET "$REACT_APP_BACKEND_URL/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Protected endpoint sample
curl -X GET "$REACT_APP_BACKEND_URL/api/marketplace/my-gigs" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing (Playwright)

```javascript
await page.context.add_cookies([{
  "name": "session_token",
  "value": "YOUR_SESSION_TOKEN",
  "domain": "your-app.com",
  "path": "/",
  "httpOnly": true,
  "secure": true,
  "sameSite": "None"
}]);
await page.goto("https://your-app.com");
```

## Checklist

- [ ] `db.users` document has `user_id` custom UUID (MongoDB `_id` is separate).
- [ ] `db.user_sessions.user_id` matches `db.users.user_id` exactly.
- [ ] All queries pass `{"_id": 0}` projection so the raw ObjectId never leaks.
- [ ] `/api/auth/me` returns user data with both a bearer token AND a cookie.
- [ ] Dashboard loads without a redirect when the session cookie is present.
- [ ] CRUD operations work with either credential.

## Success

- ✅ `/api/auth/me` returns user data
- ✅ Dashboard loads without redirect
- ✅ Protected CRUD operations work

## Failure Modes to Watch For

- ❌ 401 on `/auth/me` after callback → global AuthProvider ran before the
  session cookie was set. Fix: skip `checkAuth()` when `window.location.hash`
  contains `session_id=`.
- ❌ Redirected back to login page → cookie wasn't set with `secure=True`
  + `samesite="none"` (required for HTTPS cross-site preview environment).
- ❌ `session_id` processed twice on StrictMode → use `useRef` (not `useState`)
  as the processed flag in `AuthCallback`.
