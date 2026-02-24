# AR CLASSES - Panel Management System

## 🎯 Project Overview

A comprehensive web-based management system for AR Classes with three distinct portals (Admin, Faculty, Student) sharing a common login interface, Blue & Silver theme, and your custom logo.

---

## 📁 File Structure

```
ar classes/
├── index.html          ← 🔑 Start here! Common Login Portal
├── admin.html          ← Admin Panel for managing students, faculty, fees
├── student.html        ← Student Panel for registration, notes, attendance
├── logo.jpg            ← Your custom AR Classes logo
└── README.md           ← This file
```

---

## 🚀 How to Use

### Step 1: Open Login Portal

1. Open `index.html` in your web browser
2. You'll see three login cards: Admin, Faculty, Student

### Step 2: Login as Admin

- **Username**: `admin`
- **Password**: `password`

### Step 3: Faculty & Student Registration & Login

- Faculty and Students must first **register** in their respective panels
- After registration, they'll get an ID and password
- Use those credentials on the login portal to access their panels

### Step 4: Redirect on Login

- Users are automatically redirected to their respective panels
- Session is maintained via `localStorage`
- Users can logout from within their panels to return to the login portal

---

## 👥 User Roles

### **Admin Panel** 👑

- Approve/Reject student registrations
- Assign Student IDs and Passwords
- Approve/Reject faculty registrations
- Assign Faculty IDs and Passwords
- Manage fee structure for each class
- Monitor uploaded notes from faculty

### **Faculty Panel** 👨‍🏫

- Register (requires admin approval)
- Mark attendance for students
- Upload notes and worksheets
- Edit/Delete uploaded notes

### **Student Panel** 👨‍🎓

- Register for classes (requires admin approval)
- View uploaded notes and download
- Check attendance records
- Select subjects based on class
- View monthly fee calculations

---

## 🎨 Design Features

✅ **Unified Theme**: Blue (#1e3c72, #2a5298) & Silver (#667eea, #764ba2) gradient  
✅ **Logo Integration**: Your logo displayed on login page and all panel headers  
✅ **Responsive Design**: Works beautifully on desktop, tablet, and mobile devices  
✅ **Professional UI**: Modern glassmorphism effects, smooth transitions, shadow effects  
✅ **Font Awesome Icons**: Professional icons throughout for better UX

---

## 🔐 Authentication & Security

- **Login Portal** (`index.html`): Central entry point for all users
- **Session Management**: Uses `localStorage` to maintain user sessions
- **Automatic Redirects**:
  - If already logged in, users go directly to their panel
  - If not logged in, users cannot access panels directly
  - Logout clears session and returns to login page
- **Role-Based Access**: Each panel is exclusive to its user type

---

## 💾 Data Storage

All data is stored in browser's **localStorage** (persists across sessions):

- `students`: Student registrations
- `faculty`: Faculty registrations
- `feeStructure`: Fee configuration
- `notes`: Uploaded notes
- `attendance`: Attendance records
- `adminAuth`: Admin authentication token
- `facultyAuth`: Faculty authentication token
- `studentAuth`: Student authentication token
- `currentFaculty`: Current logged-in faculty data
- `currentStudent`: Current logged-in student data

---

## 🔧 How It Works

### Login Flow:

```
User Opens index.html
    ↓
Selects Role (Admin/Faculty/Student)
    ↓
Enters Credentials
    ↓
System Verifies Against localStorage
    ↓
Sets Authentication Token + User Data
    ↓
Redirects to Respective Panel
```

### Data Flow:

```
Student/Faculty Registration → Admin Approval → ID + Password Generated
Login with ID/Password → Access Respective Dashboard → Perform Actions
Data Saved to localStorage → Persists Across Sessions → Can be Exported
```

---

## ❌ Default Admin Credentials

- **Username**: `admin`
- **Password**: `password`

> ⚠️ **Important**: Change these credentials in production!

---

## 📊 Key Features

### Students Can:

- ✅ Register for classes
- ✅ Select subjects based on class (4-8: multiple subjects, 9-12: specific courses)
- ✅ Auto-calculate monthly fee based on subject selection
- ✅ View approved status
- ✅ Download uploaded notes
- ✅ Check attendance records
- ✅ Track payment status

### Faculty Can:

- ✅ Register (awaits admin approval)
- ✅ Mark daily attendance for students
- ✅ Upload notes, PDFs, and worksheets
- ✅ Manage uploaded files (edit/delete)
- ✅ Track payment status

### Admin Can:

- ✅ Approve/Reject student & faculty registrations
- ✅ Generate login credentials automatically
- ✅ Manage fee structure (per class + subject combo)
- ✅ Monitor all uploaded notes

---

## 🎯 Class-Based Fee Structure

### Classes 4-8 (Elementary):

- Charge based on **number of subjects selected**
- Options: Any 1, Any 2, Any 3, Any 4, All Subjects

### Classes 9-10 (Secondary):

- Fixed subjects: Maths, Science, English
- Course-based fee structure

### Classes 11-12 (Senior):

- Specialized streams: Accounts, Business Studies, Economics
- Per-subject fee structure

---

## 📱 Mobile Responsiveness

The system is fully responsive:

- **Desktop**: Three-column login cards
- **Tablet**: Two-column grid
- **Mobile**: Single column, optimized touch targets
- **All**: Font sizes, spacing, and buttons adapt perfectly

---

## 🔄 Session Management

**Auto-Login**: If a user is already authenticated, they skip the login page

```javascript
// Checks on page load:
- If adminAuth exists → Go to admin.html
- If facultyAuth + currentFaculty exist → Go to faculty.html
- If studentAuth + currentStudent exist → Go to student.html
```

**Logout**: Clears authentication and redirects to index.html

---

## 📝 Notes

- **Data Persistence**: All data stays in localStorage until manually cleared
- **Backup**: Export data regularly (localStorage data survives browser close)
- **Multi-Browser**: Each browser has its own localStorage (separate accounts)
- **Testing**: Use browser's DevTools → Application → localStorage to inspect data

---

## 🚨 Troubleshooting

| Issue               | Solution                                              |
| ------------------- | ----------------------------------------------------- |
| Logo not showing    | Ensure `logo.jpg` is in the same folder as HTML files |
| Can't login         | Check localStorage data in DevTools                   |
| Page won't load     | Ensure all HTML files in same directory               |
| Styles not applying | Clear browser cache (Ctrl+Shift+Delete)               |
| Data lost           | Check if localStorage is enabled in browser           |

---

## 🎓 Student Registration Process

1. Open **Student Panel** → Click "New Registration"
2. Fill details: Name, School, Guardian, Class
3. Select subjects based on class
4. Fee auto-calculates
5. Submit → Awaits admin approval
6. Admin: View pending students → Approve/Reject
7. System generates: **Student ID** (AR1234) and **Password**
8. Student uses these on login portal

---

## 👨‍🏫 Faculty Registration Process

1. Open **Faculty Panel** → Click "New Registration"
2. Fill: Name, Qualification, Contact, Subjects, Classes
3. Submit → Awaits admin approval
4. Admin: View pending faculty → Approve/Reject
5. System generates: **Faculty ID** (FAC1234) and **Password**
6. Faculty uses their Name + Contact on login portal

---


- **Faculty Share**: 70% of total collection
- **Institute Share**: 30% of collection
- **For Classes 9-12**: Split into 4 quarterly installments

---

## 🌐 Browser Compatibility

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile Browsers (iOS Safari, Chrome Mobile)

---

## 📞 Support Notes

- All files must be in the same directory
- `.jpg` logo file must be named exactly `logo.jpg`
- Open `index.html` first (don't access admin/faculty/student directly)
- Use modern browsers for best experience
- All features use local storage (no server needed)

---

## ✨ Features Implemented

✅ Common login portal with three role-based cards  
✅ Unified Blue & Silver theme across all panels  
✅ Logo integration on login page and headers  
✅ Responsive design (mobile, tablet, desktop)  
✅ Font Awesome icons throughout  
✅ Authentication checks on all panels  
✅ Automatic redirect on login  
✅ Session management with localStorage  
✅ Role-based data access control  
✅ Logout functionality  
✅ Professional styling with gradients & shadows  
✅ All original functionality preserved

---

## 🎉 You're All Set!

Your AR Classes management system is now complete and ready to use!

**To Get Started**:

1. Open `index.html` in your browser
2. Login as `admin` / `password`
3. Create test data to see all features in action

Enjoy managing your classes! 📚

---

**Last Updated**: February 17, 2026
