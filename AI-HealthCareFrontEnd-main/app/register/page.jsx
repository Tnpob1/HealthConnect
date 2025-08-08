// app/register/page.jsx

"use client"; // สำหรับ Next.js App Router

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Import useRouter

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('none'); // 'none', 'weak', 'medium', 'strong'
  const [emailCheckStatus, setEmailCheckStatus] = useState(''); // 'checking', 'available', 'unavailable'
  const [emailError, setEmailError] = useState('');
  const [message, setMessage] = useState(''); // เพิ่ม state สำหรับข้อความแจ้งเตือน
  const [isSubmitting, setIsSubmitting] = useState(false); // เพิ่ม state สำหรับสถานะการส่งฟอร์ม
  const router = useRouter(); // Initialize useRouter

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);

    let strength = 'weak';
    let score = 0;

    // Check for length
    if (newPassword.length >= 8) {
      score += 1;
    }
    // Check for uppercase letters
    if (/[A-Z]/.test(newPassword)) {
      score += 1;
    }
    // Check for lowercase letters
    if (/[a-z]/.test(newPassword)) {
      score += 1;
    }
    // Check for numbers
    if (/[0-9]/.test(newPassword)) {
      score += 1;
    }
    // Check for special characters (optional, but good for strong passwords)
    if (/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      score += 1;
    }

    if (newPassword.length === 0) {
      strength = 'none';
    } else if (score < 3) {
      strength = 'weak';
    } else if (score === 3 || score === 4) {
      strength = 'medium';
    } else if (score >= 5) {
      strength = 'strong';
    }

    setPasswordStrength(strength);
  };

  const handleEmailCheck = async () => {
    if (!email) {
      setEmailError('กรุณากรอกอีเมลก่อน');
      setEmailCheckStatus(''); // Reset status if email is empty
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('รูปแบบอีเมลไม่ถูกต้อง');
      setEmailCheckStatus(''); // Reset status if format is invalid
      return;
    }

    setEmailCheckStatus('checking');
    setEmailError(''); // Clear previous email errors

    try {
      // *** แก้ไขตรงนี้: เพิ่ม Full URL ของ Backend Server ***
      const response = await fetch(`http://localhost:4000/api/check-email?email=${email}`);
      const data = await response.json();

      if (data.isEmailTaken) {
        setEmailCheckStatus('unavailable');
        setEmailError('อีเมลนี้ถูกใช้ไปแล้ว');
      } else {
        setEmailCheckStatus('available');
      }
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailCheckStatus('');
      setEmailError('เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); // ล้างข้อความแจ้งเตือนเดิม
    setIsSubmitting(true); // ตั้งค่าสถานะกำลังส่ง

    // ตรวจสอบความถูกต้องก่อนส่งข้อมูล
    const isPasswordStrongEnough = passwordStrength === 'medium' || passwordStrength === 'strong';

    if (!name || !email || !password) {
      setMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
      setIsSubmitting(false);
      return;
    }
    if (!isPasswordStrongEnough) {
      setMessage('รหัสผ่านต้องมีความแข็งแรงระดับปานกลางหรือแข็งแรง');
      setIsSubmitting(false);
      return;
    }
    if (emailError || emailCheckStatus !== 'available') {
      setMessage('กรุณาตรวจสอบอีเมลและให้แน่ใจว่าอีเมลสามารถใช้งานได้');
      setIsSubmitting(false);
      return;
    }

    try {
      // *** แก้ไขตรงนี้: เพิ่ม Full URL ของ Backend Server ***
      const response = await fetch('http://localhost:4000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        setMessage('สมัครสมาชิกสำเร็จ! กำลังนำทางไปหน้าเข้าสู่ระบบ...');
        setTimeout(() => {
          router.push('/login'); // นำทางไปหน้า Login
        }, 2000); // หน่วงเวลา 2 วินาทีก่อนนำทาง
      } else {
        setMessage(data.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      }
    } catch (error) {
      console.error('An error occurred during registration:', error);
      setMessage('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setIsSubmitting(false); // ตั้งค่าสถานะเสร็จสิ้นการส่ง
    }
  };

  // ฟังก์ชันช่วยในการกำหนดสีของแถบความปลอดภัย
  const getStrengthColor = (level) => {
    switch (level) {
      case 'weak':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'strong':
        return 'bg-green-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-center text-gray-900">
          สร้างบัญชีใหม่
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {message && ( // แสดงข้อความแจ้งเตือน
            <div className={`p-3 rounded-md text-center ${message.includes('สำเร็จ') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              ชื่อผู้ใช้งาน
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" // เพิ่ม text-gray-900
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting} // ปุ่มจะถูก disable เมื่อกำลังส่งฟอร์ม
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              อีเมล
            </label>
            <div className="flex mt-1">
              <input
                id="email"
                name="email"
                type="email"
                required
                className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" // เพิ่ม text-gray-900
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => { setEmailCheckStatus(''); setEmailError(''); }} // Clear status and error on focus
                disabled={isSubmitting} // ปุ่มจะถูก disable เมื่อกำลังส่งฟอร์ม
              />
              <button
                type="button"
                onClick={handleEmailCheck}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-r-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                disabled={!email || emailCheckStatus === 'checking' || isSubmitting} // ปุ่มจะถูก disable เมื่อกำลังส่งฟอร์มด้วย
              >
                {emailCheckStatus === 'checking' ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
              </button>
            </div>
            {emailError && (
              <p className="mt-2 text-sm text-red-600">{emailError}</p>
            )}
            {emailCheckStatus === 'available' && (
              <p className="mt-2 text-sm text-green-600">✅ อีเมลนี้สามารถใช้งานได้</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              รหัสผ่าน
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900" // เพิ่ม text-gray-900
              value={password}
              onChange={handlePasswordChange}
              disabled={isSubmitting} // ปุ่มจะถูก disable เมื่อกำลังส่งฟอร์ม
            />
            {/* แถบแสดงความปลอดภัยของรหัสผ่าน */}
            <div className="mt-2 flex space-x-1 h-2 rounded-full overflow-hidden">
              <div
                className={`flex-1 ${passwordStrength === 'strong' ? 'bg-green-500' : (passwordStrength === 'medium' ? 'bg-yellow-500' : (passwordStrength === 'weak' ? 'bg-red-500' : 'bg-gray-300'))} rounded-full`}
              ></div>
              <div
                className={`flex-1 ${passwordStrength === 'strong' ? 'bg-green-500' : (passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-gray-300')} rounded-full`}
              ></div>
              <div
                className={`flex-1 ${passwordStrength === 'strong' ? 'bg-green-500' : 'bg-gray-300'} rounded-full`}
              ></div>
            </div>
            {passwordStrength !== 'none' && (
              <p className={`mt-2 text-sm ${getStrengthColor(passwordStrength).replace('bg-', 'text-')}`}>
                ความปลอดภัย: {passwordStrength === 'weak' ? 'อ่อน' : (passwordStrength === 'medium' ? 'ปานกลาง' : 'แข็งแรง')}
              </p>
            )}
          </div>
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isSubmitting} // ปุ่มจะถูก disable เมื่อกำลังส่งฟอร์ม
            >
              {isSubmitting ? 'กำลังสมัคร...' : 'ลงทะเบียน'}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center space-x-4 mt-6">
          <Link href="/" passHref>
            <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-transparent border border-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              กลับหน้าหลัก
            </button>
          </Link>

          <Link href="/login" passHref> {/* เปลี่ยนเป็น /login เพื่อกลับไปหน้า Login */}
            <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              เข้าสู่ระบบ
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
