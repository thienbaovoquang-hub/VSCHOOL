import React, { useState } from 'react';
import {
  HeartHandshake, Plus, Calendar, Clock, User, ShieldCheck,
  Compass, GraduationCap, Brain
} from 'lucide-react';
import { CounselingRequest, UserProfile } from '../types';
import { LiquidCard } from '../components/common/LiquidCard';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { canViewConfidentialCounseling } from '../utils/rbac';
import confetti from 'canvas-confetti';

interface CounselingViewProps {
  counselingRequests: CounselingRequest[];
  currentUser: UserProfile;
  onSubmitRequest: (req: CounselingRequest) => Promise<void>;
  onUpdateStatus: (id: string, status: CounselingRequest['status'], meetingNotes?: string) => Promise<void>;
}

export const CounselingView: React.FC<CounselingViewProps> = ({
  counselingRequests,
  currentUser,
  onSubmitRequest,
  onUpdateStatus,
}) => {
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);

  const [type, setType] = useState<CounselingRequest['type']>('psychological');
  const [topic, setTopic] = useState('');
  const [preferredDate, setPreferredDate] = useState(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('15:30 - 16:30 (Sau giờ tan trường)');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedCase, setSelectedCase] = useState<CounselingRequest | null>(null);
  const [counselorNotes, setCounselorNotes] = useState('');

  const isCounselor = canViewConfidentialCounseling(currentUser.role);

  // Strict privacy: counselor sees all student cases; student sees only their own requests; others see nothing.
  const visibleRequests = counselingRequests.filter((r) => {
    if (isCounselor) return true;
    if (currentUser.role === 'student') {
      return r.studentId === currentUser.id || (currentUser.linkedProfileId && r.studentId === currentUser.linkedProfileId);
    }
    return false;
  });

  const handleBookSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsSubmitting(true);
    try {
      const code = `CSL-2026-${String(counselingRequests.length + 1).padStart(3, '0')}`;
      const newReq: CounselingRequest = {
        id: `${code}-${Date.now().toString().slice(-3)}`,
        requestCode: code,
        type,
        studentId: currentUser.id,
        studentName: currentUser.displayName,
        studentClass: currentUser.className || 'THPT',
        topic: topic.trim(),
        preferredDate,
        preferredTimeSlot,
        notes: notes.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await onSubmitRequest(newReq);
      confetti({ particleCount: 40, spread: 50 });
      setIsBookModalOpen(false);
      setTopic('');
      setNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCounselorNotes = async () => {
    if (!selectedCase) return;
    await onUpdateStatus(selectedCase.id, 'confirmed', counselorNotes);
    setSelectedCase(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Tư vấn Tâm lý Học đường, Học tập & Hướng nghiệp
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Không gian lắng nghe an toàn, bảo mật riêng tư giữa học sinh và chuyên viên tâm lý
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBookModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-sky-400 text-white text-xs font-bold shadow-md shadow-teal-500/20 hover:opacity-95 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Đặt Lịch Tư vấn 1-1
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LiquidCard className="p-4 bg-gradient-to-br from-white/80 via-teal-50/30 to-white/70 dark:from-slate-800/80 dark:via-teal-950/20 dark:to-slate-900/70 border-teal-100 dark:border-teal-900/50">
          <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center mb-2.5">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Tư vấn Tâm lý Học đường</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Giải tỏa lo âu mùa thi cử, cân bằng cảm xúc, các mối quan hệ bạn bè và gia đình trong sự tôn trọng và bảo mật.
          </p>
        </LiquidCard>

        <LiquidCard className="p-4 bg-gradient-to-br from-white/80 via-sky-50/30 to-white/70 dark:from-slate-800/80 dark:via-sky-950/20 dark:to-slate-900/70 border-sky-100 dark:border-sky-900/50">
          <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center justify-center mb-2.5">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Tư vấn Phương pháp Học tập</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Kế hoạch ôn tập cá nhân hóa, khắc phục môn học yếu thế, cải thiện khả năng tập trung và kỹ năng tự học hiệu quả.
          </p>
        </LiquidCard>

        <LiquidCard className="p-4 bg-gradient-to-br from-white/80 via-indigo-50/30 to-white/70 dark:from-slate-800/80 dark:via-indigo-950/20 dark:to-slate-900/70 border-indigo-100 dark:border-indigo-900/50">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center mb-2.5">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Định hướng Ngành & Nghề nghiệp</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Khám phá thiên hướng tính cách, thông tin tuyển sinh đại học và lộ trình phát triển nghề nghiệp tương lai.
          </p>
        </LiquidCard>
      </div>

      <LiquidCard className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-700/60 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {isCounselor ? 'Danh sách Lịch hẹn Tư vấn của Học sinh' : 'Lịch hẹn Tư vấn của Bạn'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isCounselor
                  ? 'Chỉ Chuyên viên tư vấn tâm lý được quyền truy cập hồ sơ bảo mật này'
                  : 'Bảo mật riêng tư, không hiển thị với Ban Giám hiệu, Quản trị viên hoặc học sinh khác'}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {visibleRequests.length} lịch hẹn
          </span>
        </div>

        <div className="space-y-3">
          {visibleRequests.map((req) => (
            <div
              key={req.id}
              className="p-4 rounded-2xl bg-white/75 dark:bg-slate-800/75 border border-slate-200/70 dark:border-slate-700 shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-teal-800 dark:text-teal-300 tabular-nums">
                    {req.requestCode}
                  </span>
                  <Badge variant={req.type === 'psychological' ? 'aqua' : req.type === 'career' ? 'purple' : 'blue'}>
                    {req.type === 'psychological'
                      ? 'Tâm lý học đường'
                      : req.type === 'career'
                      ? 'Hướng nghiệp'
                      : 'Phương pháp học tập'}
                  </Badge>
                  <Badge variant={req.status === 'confirmed' ? 'mint' : req.status === 'completed' ? 'gray' : 'amber'}>
                    {req.status === 'confirmed'
                      ? 'Đã xếp lịch'
                      : req.status === 'completed'
                      ? 'Đã hoàn thành'
                      : 'Đang chờ xếp lịch'}
                  </Badge>
                </div>

                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1">{req.topic}</h4>
                {req.notes && <p className="text-xs text-slate-500 dark:text-slate-400">{req.notes}</p>}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-400" /> {req.studentName} ({req.studentClass})
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Ngày hẹn: {req.preferredDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {req.preferredTimeSlot}
                  </span>
                </div>

                {req.meetingNotes && (
                  <div className="mt-2 p-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/50 text-xs text-teal-900 dark:text-teal-200">
                    <span className="font-bold">Ghi chú từ Chuyên viên tư vấn:</span> {req.meetingNotes}
                  </div>
                )}
              </div>

              {isCounselor && (
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCase(req);
                      setCounselorNotes(req.meetingNotes || '');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                  >
                    Xác nhận & Ghi chú
                  </button>
                  {req.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(req.id, 'completed')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Hoàn thành
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {visibleRequests.length === 0 && (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center">
              <HeartHandshake className="w-10 h-10 text-teal-400 mb-2 stroke-1" />
              <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">Chưa có lịch hẹn tư vấn nào</p>
              <p className="text-slate-400 dark:text-slate-500 max-w-sm mt-1 mb-4">
                Mọi trao đổi với chuyên viên tâm lý và cố vấn hướng nghiệp được bảo mật tuyệt đối.
              </p>
              <button
                type="button"
                onClick={() => setIsBookModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Đặt lịch tư vấn ngay
              </button>
            </div>
          )}
        </div>
      </LiquidCard>

      {/* Book Session Modal */}
      {isBookModalOpen && (
        <Modal
          isOpen={isBookModalOpen}
          onClose={() => setIsBookModalOpen(false)}
          title="Đăng ký Buổi Tư vấn Học đường 1-1"
          description="Nội dung trao đổi được bảo vệ theo nguyên tắc đạo đức nghề nghiệp và giữ bí mật tuyệt đối"
          maxWidth="2xl"
        >
          <form onSubmit={handleBookSession} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Chủ đề tư vấn bạn quan tâm *</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'psychological', label: 'Tâm lý học đường' },
                  { id: 'academic', label: 'Phương pháp học tập' },
                  { id: 'career', label: 'Định hướng nghề nghiệp' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as CounselingRequest['type'])}
                    className={`p-2.5 rounded-xl border font-semibold text-left transition-all cursor-pointer ${
                      type === item.id
                        ? 'bg-teal-500 text-white border-teal-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-teal-50/50 dark:hover:bg-teal-950/30'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Vấn đề hoặc thắc mắc cụ thể *</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ví dụ: Áp lực kỳ thi, phương pháp học hiệu quả, chọn khối thi..."
                className="w-full bg-white/85 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Ngày mong muốn</label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full bg-white/85 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Khung giờ hẹn</label>
                <select
                  value={preferredTimeSlot}
                  onChange={(e) => setPreferredTimeSlot(e.target.value)}
                  className="w-full bg-white/85 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-100"
                >
                  <option value="11:30 - 12:30 (Giờ nghỉ trưa)">11:30 - 12:30 (Giờ nghỉ trưa)</option>
                  <option value="15:30 - 16:30 (Sau giờ tan trường)">15:30 - 16:30 (Sau giờ tan trường)</option>
                  <option value="16:30 - 17:30 (Cuối buổi chiều)">16:30 - 17:30 (Cuối buổi chiều)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Ghi chú thêm cho chuyên viên tư vấn (nếu có)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Chia sẻ thêm điều bạn mong muốn nhận được sau buổi tư vấn..."
                className="w-full bg-white/85 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/50 flex items-center gap-2 text-[11px] text-teal-800 dark:text-teal-200">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>Chuyên viên Tư vấn Tâm lý của nhà trường sẽ xác nhận lịch hẹn trong vòng 24 giờ.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-700 mt-4">
              <button
                type="button"
                onClick={() => setIsBookModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-sky-400 text-white font-bold shadow-md shadow-teal-500/20 hover:opacity-95 cursor-pointer"
              >
                {isSubmitting ? 'Đang gửi...' : 'Xác nhận Đặt lịch'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Counselor Notes Modal */}
      {selectedCase && (
        <Modal
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          title={`Tiếp nhận Hồ sơ Tư vấn: ${selectedCase.studentName}`}
          description={`Chủ đề: ${selectedCase.topic} · Lớp ${selectedCase.studentClass}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Ghi chú phản hồi / Địa điểm hẹn
              </label>
              <textarea
                rows={4}
                value={counselorNotes}
                onChange={(e) => setCounselorNotes(e.target.value)}
                placeholder="Xác nhận thời gian, phòng tư vấn và ghi chú chuẩn bị..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSaveCounselorNotes}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-sm cursor-pointer"
              >
                Lưu Xác nhận Lịch
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
