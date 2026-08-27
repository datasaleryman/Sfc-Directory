async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '2026' })
  }).then(r => r.json());
  
  const token = loginRes.token;

  const exRes = await fetch('http://localhost:3000/api/existing-accounts', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json());
  console.log('Existing Accounts keys:', Object.keys(exRes));
  console.log('Existing Accounts sample:', Array.isArray(exRes) ? exRes.length : exRes);

  const uRes = await fetch('http://localhost:3000/api/users', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json());
  console.log('Users keys:', Object.keys(uRes));
  console.log('Users sample:', Array.isArray(uRes) ? uRes.length : uRes);
}
test().then(() => fs.unlinkSync('test_endpoints.cjs')).catch(console.error);
