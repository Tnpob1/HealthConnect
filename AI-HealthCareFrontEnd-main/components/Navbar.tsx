import React from 'react'
import Link from 'next/link';
import { useAuth } from '../app/context/AuthContext'; // ตรวจสอบเส้นทางให้ถูกต้อง

export default function Navbar() {
    const { user, isLoggedIn, logout, loading } = useAuth(); // ดึงสถานะและฟังก์ชันจาก AuthContext

  return (<>
    <header className="bg-white shadow-md p-4 flex justify-between items-center"
      style={{backgroundColor: 'rgba(240, 244, 248, 0.5)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        <h1 className="text-2xl font-bold text-green-500">HealthConnect</h1>
        <div>
          {isLoggedIn ? (
            <div className="flex items-center space-x-4"> {/* นี่คือ flex container ที่จัดเรียงทุกอย่าง */}
              {/* รูปโปรไฟล์ผู้ใช้งาน (แสดงอักษรแรกของชื่อ) */}
              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 font-bold text-lg">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              {/* ชื่อผู้ใช้งาน */}
              <span className="text-gray-700 font-medium">
                {user?.name || 'ผู้ใช้งาน'}
              </span>
              
              {/* ปุ่มบัญชีผู้ใช้ ที่เชื่อมโยงไปยังหน้า /user */}
              <Link href="/user" passHref>
                <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                  บัญชีผู้ใช้
                </button>
              </Link>

              {/* ปุ่ม Logout */}
              <button
                onClick={logout} // เรียกใช้ฟังก์ชัน logout จาก AuthContext
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <div>
              <Link href="/login" passHref>
                <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mr-2">
                  เข้าสู่ระบบ
                </button>
              </Link>
              <Link href="/register" passHref>
                <button className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 mr-2">
                  สมัครสมาชิก
                </button>
              </Link>
            </div>
          )}
        </div>
      </header>
    </>
  )
}
