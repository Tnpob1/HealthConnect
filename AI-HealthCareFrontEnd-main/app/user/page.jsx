// app/user/page.jsx

"use client"; // จำเป็นสำหรับ Next.js App Router เพื่อให้ใช้ hooks ได้

import { useState, useEffect } from 'react';
import Link from 'next/link';
import withAuth from '../../components/withAuth'; // Import withAuth (ตรวจสอบเส้นทางให้ถูกต้อง)
import { useAuth } from '../context/AuthContext'; // Import useAuth hook (ตรวจสอบเส้นทางให้ถูกต้อง)

// สร้าง Component หลักสำหรับเนื้อหาหน้า User
function UserPageContent() {
  const { user, loading, token, login } = useAuth(); // ดึง user, loading, token, และ login function จาก AuthContext
  const [isEditing, setIsEditing] = useState(false); // สถานะสำหรับเปิด/ปิดโหมดแก้ไข
  const [editName, setEditName] = useState(''); // State สำหรับชื่อที่แก้ไข
  const [editEmail, setEditEmail] = useState(''); // State สำหรับอีเมลที่แก้ไข
  const [newPassword, setNewPassword] = useState(''); // State สำหรับรหัสผ่านใหม่
  const [passwordStrength, setPasswordStrength] = useState('none'); // State สำหรับความแข็งแรงรหัสผ่านใหม่
  const [message, setMessage] = useState(''); // State สำหรับข้อความแจ้งเตือน (สำเร็จ/ผิดพลาด)
  const [isSaving, setIsSaving] = useState(false); // State สำหรับสถานะกำลังบันทึก

  // ตั้งค่าข้อมูลเริ่มต้นเมื่อ user โหลดเสร็จ หรือเมื่อเข้าสู่โหมดแก้ไข
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditEmail(user.email || '');
    }
  }, [user]);

  // ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงรหัสผ่านใหม่ (เหมือนในหน้า Register)
  const handleNewPasswordChange = (e) => {
    const pwd = e.target.value;
    setNewPassword(pwd);

    let strength = 'none';
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score += 1;

    if (pwd.length === 0) {
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

  // ฟังก์ชันช่วยในการกำหนดสีของแถบความปลอดภัย
  const getStrengthColor = (level) => {
    switch (level) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  // ฟังก์ชันสำหรับบันทึกการเปลี่ยนแปลง
  const handleSave = async () => {
    setMessage('');
    setIsSaving(true);

    // ตรวจสอบความแข็งแรงของรหัสผ่านใหม่ (ถ้ามีการกรอก)
    if (newPassword && (passwordStrength === 'weak' || passwordStrength === 'none')) {
      setMessage('รหัสผ่านใหม่ต้องมีความแข็งแรงระดับปานกลางหรือแข็งแรง');
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:4000/api/users/${user.id}`, { // เรียก API เพื่ออัปเดตข้อมูลผู้ใช้
        method: 'PUT', // ใช้ HTTP PUT method สำหรับการอัปเดต
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // ส่ง JWT Token เพื่อยืนยันตัวตน
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          password: newPassword || undefined, // ส่งรหัสผ่านใหม่ก็ต่อเมื่อมีการกรอก
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('บันทึกข้อมูลสำเร็จ!');
        setIsEditing(false); // ออกจากโหมดแก้ไข
        // อัปเดตข้อมูลผู้ใช้ใน Context ทันที
        // สมมติว่า Backend ส่งข้อมูลผู้ใช้ที่อัปเดตแล้วกลับมา
        login(data.user, token); // อัปเดต user ใน AuthContext
        setNewPassword(''); // ล้างช่องรหัสผ่านใหม่
        setPasswordStrength('none'); // รีเซ็ตความแข็งแรงรหัสผ่าน
      } else {
        setMessage(data.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (error) {
      console.error('Error saving user data:', error);
      setMessage('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setIsSaving(false);
    }
  };

  // แสดง Loading state ชั่วคราวในขณะที่ Context กำลังโหลดข้อมูลผู้ใช้
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-700">กำลังโหลดข้อมูลผู้ใช้...</p>
      </div>
    );
  }

  // หากผู้ใช้ไม่ได้ล็อกอิน (ซึ่ง withAuth ควรจะ redirect ไปหน้า login แล้ว)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-red-500">ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบ</p>
        <Link href="/login" passHref>
          <button className="ml-4 px-4 py-2 text-sm font-medium text-blue-600 bg-transparent border border-blue-600 rounded-md hover:bg-blue-50">
            เข้าสู่ระบบ
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          โปรไฟล์ผู้ใช้งาน
        </h2>

        {message && ( // แสดงข้อความแจ้งเตือน
          <div className={`p-3 rounded-md text-center ${message.includes('สำเร็จ') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col items-center">
            {/* ส่วนสำหรับรูปโปรไฟล์ (ไม่มีปุ่มอัปโหลดแล้ว) */}
            <div className="w-24 h-24 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 text-5xl font-bold mb-4 overflow-hidden relative">
              {/* Placeholder สำหรับรูปโปรไฟล์ */}
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              {/* ลบส่วน label และ input type="file" ออกไป */}
            </div>

            {/* ส่วนแสดง/แก้ไขข้อมูล */}
            {!isEditing ? (
              <>
                <p className="text-2xl font-semibold text-gray-800">
                  {user.name}
                </p>
                <p className="text-md text-gray-600">
                  {user.email}
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-4 px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  แก้ไขโปรไฟล์
                </button>
              </>
            ) : (
              <div className="w-full space-y-4">
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 text-left">
                    ชื่อผู้ใช้งาน
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 text-left">
                    อีเมล
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 text-left">
                    รหัสผ่านใหม่ (เว้นว่างถ้าไม่ต้องการเปลี่ยน)
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-gray-900"
                    value={newPassword}
                    onChange={handleNewPasswordChange}
                    disabled={isSaving}
                  />
                  {/* แถบแสดงความปลอดภัยของรหัสผ่านใหม่ */}
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
                  {newPassword.length > 0 && ( // แสดงข้อความความปลอดภัยเมื่อมีการพิมพ์รหัสผ่านใหม่
                    <p className={`mt-2 text-sm ${getStrengthColor(passwordStrength).replace('bg-', 'text-')}`}>
                      ความปลอดภัย: {passwordStrength === 'weak' ? 'อ่อน' : (passwordStrength === 'medium' ? 'ปานกลาง' : 'แข็งแรง')}
                    </p>
                  )}
                </div>
                <div className="flex justify-center space-x-4 mt-6">
                  <button
                    onClick={handleSave}
                    className="px-6 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    disabled={isSaving}
                  >
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false); // ยกเลิกโหมดแก้ไข
                      setMessage(''); // ล้างข้อความแจ้งเตือน
                      setNewPassword(''); // ล้างรหัสผ่านใหม่ที่กรอกไว้
                      setPasswordStrength('none'); // รีเซ็ตความแข็งแรงรหัสผ่าน
                      // รีเซ็ตค่า editName, editEmail กลับเป็นค่าเดิมของ user
                      if (user) {
                        setEditName(user.name || '');
                        setEditEmail(user.email || '');
                      }
                    }}
                    className="px-6 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    disabled={isSaving}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ปุ่มกลับหน้าหลัก */}
        <div className="mt-8">
          <Link href="/" passHref>
            <button className="px-6 py-2 text-md font-medium text-blue-600 bg-transparent border border-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              กลับหน้าหลัก
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Export Component ด้วย Higher-Order Component (HOC) withAuth เพื่อป้องกันเส้นทาง
export default withAuth(UserPageContent);
