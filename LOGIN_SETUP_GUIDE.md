# Login System - Setup Guide

## ✅ What Has Been Fixed

The login system has been updated to work without pre-seeded users. Here's what changed:

### 1. **Auto-Creating Users**
   - When a user logs in, if they don't exist in the database, they're automatically created
   - New users default to **GAA** role (admin)

### 2. **New Initialization Page**
   - Easy web interface to create test users
   - No need to run CLI commands
   - Location: `http://localhost:3000/init-test-users`

### 3. **New Signup API**
   - Endpoint: `POST /api/auth/signup`
   - Allows users to self-register accounts

---

## 🚀 How to Login

### Option 1: Using the Initialization Page (Recommended)

1. **Get Your Service Role Key:**
   - Go to https://app.supabase.com/
   - Login and select your project
   - Navigate to **Settings** → **API**
   - Copy the **Service Role** key (the secret one, NOT the anon key)

2. **Initialize Test Users:**
   - Open http://localhost:3000/init-test-users
   - Paste your Service Role Key
   - Click **Initialize Test Users**
   - Copy the credentials displayed

3. **Login:**
   - Go to http://localhost:3000/login
   - Use any of the test credentials provided

---

### Option 2: Quick Sign Up

1. Go to http://localhost:3000/login
2. Enter email and password to create a new account
3. The system will auto-create your profile
4. You'll be redirected to your dashboard

---

## 📋 Default Test Credentials

After initialization, you'll have these accounts:

| Role | Email | Password |
|------|-------|----------|
| **Admin (GAA)** | admin@university.edu | Admin@12345 |
| **Evaluating Officer** | officer@university.edu | Officer@12345 |
| **PHI Inspector** | phi@university.edu | Phi@12345 |
| **Admin Officer** | admin.officer@university.edu | AdminOff@12345 |
| **Vice Chancellor** | vc@university.edu | VC@12345 |

---

## 🔧 Environment Variable Update

If you want to use the seed script, add this to your `.env`:

```env
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

Then run:
```bash
npm run seed
```

---

## ✨ Features

- ✅ **Auto User Creation** - Users are created in the database on first login
- ✅ **Role-Based Redirects** - Each role is redirected to their dashboard
- ✅ **Web-Based Initialization** - No CLI needed
- ✅ **Self-Registration** - Users can sign up their own accounts
- ✅ **Security** - Passwords are hashed by Supabase

---

## 🔗 Quick Links

- **Login Page**: http://localhost:3000/login
- **Initialize Test Users**: http://localhost:3000/init-test-users
- **Dashboard**: http://localhost:3000/dashboard

---

## 🆘 Troubleshooting

### "Invalid email or password"
- Make sure you've run the initialization
- Check email/password spelling
- Verify Supabase Service Role Key is correct

### "Your account is not fully set up yet"
- This should not appear now (auto-creation is enabled)
- If it does, your database connection might be down

### "Server configuration error"
- Check your `.env` file has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Restart the dev server after updating `.env`

---

## 📝 Next Steps

1. **Visit**: http://localhost:3000/init-test-users
2. **Provide**: Your Supabase Service Role Key
3. **Initialize**: Click the button
4. **Login**: Use the credentials at http://localhost:3000/login
5. **Explore**: Access role-specific dashboards

Enjoy! 🎉
