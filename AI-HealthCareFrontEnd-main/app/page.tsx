"use client"; // ต้องมี "use client" เพื่อใช้ hooks

import React from 'react';
import Link from 'next/link';
import { useAuth } from './context/AuthContext'; // ตรวจสอบเส้นทางให้ถูกต้อง
import FloatingChatButton from '../components/FloatingChatButton'; // Import FloatingChatButton
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Home() {
  const { user, isLoggedIn, logout, loading } = useAuth(); // ดึงสถานะและฟังก์ชันจาก AuthContext

  // แสดง Loading state ชั่วคราวในขณะที่ Context กำลังโหลดข้อมูลผู้ใช้
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-700">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100" style={{
    backgroundImage: `url('/images/bgimage.jpg')`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundBlendMode: 'overlay',
    backgroundColor: 'rgba(240, 244, 248, 0.5)',
    backgroundAttachment: 'fixed',
    backgroundClip: 'border-box',
    backgroundOrigin: 'border-box',     
  }}>
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center px-4">
        <section className="bg-white rounded-lg shadow-md p-8 max-w-xl w-full mt-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">ยินดีต้อนรับสู่ HealthConnect</h2>
          <p className="text-gray-600 mb-6">
            HealthConnect คือแพลตฟอร์มแชทสำหรับผู้ดูแลและผู้ป่วย เพื่อการสื่อสารที่สะดวกและปลอดภัย
            คุณสามารถพูดคุย สอบถามข้อมูลสุขภาพ หรือขอคำแนะนำจากผู้เชี่ยวชาญได้ตลอดเวลา
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-6">
            <li>แชทกับผู้ดูแลหรือ Ai ผู้เชี่ยวชาญได้ทันที</li>
            <li>ระบบแจ้งเตือนนัดหมายและติดตามสุขภาพ</li>
            <li>ข้อมูลปลอดภัยและเป็นส่วนตัว</li>
          </ul>
        </section>
      </main>
      <Footer />

      {/* เพิ่มเงื่อนไขการแสดงผล FloatingChatButton */}
      {isLoggedIn && <FloatingChatButton />}
    </div>
  );
}
