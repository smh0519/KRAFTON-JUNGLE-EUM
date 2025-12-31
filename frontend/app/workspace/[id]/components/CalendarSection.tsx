"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiClient, CalendarEvent, CreateEventRequest } from "../../../lib/api";

interface CalendarSectionProps {
  workspaceId: number;
}

const colorOptions = [
  { value: "bg-blue-500", label: "파랑" },
  { value: "bg-purple-500", label: "보라" },
  { value: "bg-green-500", label: "초록" },
  { value: "bg-amber-500", label: "주황" },
  { value: "bg-rose-500", label: "빨강" },
  { value: "bg-cyan-500", label: "청록" },
];

export default function CalendarSection({ workspaceId }: CalendarSectionProps) {
  // today를 useMemo로 래핑하여 컴포넌트 마운트 시 계산
  const today = useMemo(() => new Date(), []);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<"month" | "week">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 일정 생성 폼
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "10:00",
    color: "bg-blue-500",
    isAllDay: false,
  });

  // 이벤트 로드
  const loadEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      // 현재 월의 시작일과 끝일 계산
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const response = await apiClient.getWorkspaceEvents(
        workspaceId,
        startOfMonth.toISOString().split("T")[0],
        endOfMonth.toISOString().split("T")[0]
      );
      setEvents(response.events);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // 컴포넌트 마운트 시 오늘 날짜 선택
  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.start_at);
      return (
        eventStart.getFullYear() === date.getFullYear() &&
        eventStart.getMonth() === date.getMonth() &&
        eventStart.getDate() === date.getDate()
      );
    });
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(today);
  };

  const isToday = (date: Date) => {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const isSelected = (date: Date) => {
    return (
      selectedDate &&
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const openCreateModal = (date?: Date) => {
    const targetDate = date || selectedDate || today;
    const dateStr = targetDate.toISOString().split("T")[0];
    setNewEvent({
      title: "",
      description: "",
      startDate: dateStr,
      startTime: "09:00",
      endDate: dateStr,
      endTime: "10:00",
      color: "bg-blue-500",
      isAllDay: false,
    });
    setShowCreateModal(true);
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim() || isCreating) return;

    try {
      setIsCreating(true);
      const startAt = new Date(`${newEvent.startDate}T${newEvent.startTime}:00`);
      const endAt = new Date(`${newEvent.endDate}T${newEvent.endTime}:00`);

      const eventData: CreateEventRequest = {
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || undefined,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        is_all_day: newEvent.isAllDay,
        color: newEvent.color,
      };

      const createdEvent = await apiClient.createEvent(workspaceId, eventData);
      setEvents((prev) => [...prev, createdEvent]);
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to create event:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    try {
      await apiClient.deleteEvent(workspaceId, eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const days = getDaysInMonth(currentDate);
  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Calendar */}
      <div className="flex-1 flex flex-col border-r border-black/5">
        {/* Header */}
        <div className="px-8 py-5 border-b border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-black">{formatMonth(currentDate)}</h1>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm text-black/60 hover:text-black hover:bg-black/5 rounded-lg transition-colors"
            >
              오늘
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/[0.03] rounded-lg p-1 mr-4">
              <button
                onClick={() => setView("month")}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${view === "month"
                    ? "bg-white text-black shadow-sm"
                    : "text-black/50 hover:text-black/70"
                  }`}
              >
                월
              </button>
              <button
                onClick={() => setView("week")}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${view === "week"
                    ? "bg-white text-black shadow-sm"
                    : "text-black/50 hover:text-black/70"
                  }`}
              >
                주
              </button>
            </div>
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-black/5 text-black/40 hover:text-black/70 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-black/5 text-black/40 hover:text-black/70 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-2">
            {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
              <div
                key={day}
                className={`text-center text-sm font-medium py-2 ${index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : "text-black/40"
                  }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dayEvents = getEventsForDate(date);
              const dayOfWeek = date.getDay();

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`aspect-square p-1 rounded-xl transition-all relative ${isSelected(date)
                      ? "bg-black text-white"
                      : isToday(date)
                        ? "bg-black/5"
                        : "hover:bg-black/[0.03]"
                    }`}
                >
                  <span
                    className={`text-sm font-medium ${isSelected(date)
                        ? "text-white"
                        : dayOfWeek === 0
                          ? "text-red-400"
                          : dayOfWeek === 6
                            ? "text-blue-400"
                            : "text-black"
                      }`}
                  >
                    {date.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`w-1.5 h-1.5 rounded-full ${isSelected(date) ? "bg-white/60" : (event.color || "bg-blue-500")
                            }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Details Sidebar */}
      <div className="w-96 flex flex-col">
        <div className="px-6 py-5 border-b border-black/5">
          <h2 className="text-lg font-semibold text-black">
            {selectedDate
              ? selectedDate.toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })
              : "날짜를 선택하세요"}
          </h2>
          <p className="text-sm text-black/40 mt-0.5">
            {selectedEvents.length > 0
              ? `${selectedEvents.length}개의 일정`
              : "일정 없음"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-1 h-full min-h-[60px] rounded-full ${event.color || "bg-blue-500"}`} />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-black">{event.title}</h3>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-1 rounded hover:bg-black/10 text-black/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-sm text-black/50 mt-1">
                        {event.is_all_day
                          ? "종일"
                          : `${formatEventTime(event.start_at)} - ${formatEventTime(event.end_at)}`}
                      </p>
                      {event.description && (
                        <p className="text-sm text-black/40 mt-2">{event.description}</p>
                      )}
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center gap-1 mt-3">
                          <div className="flex -space-x-1">
                            {event.attendees.slice(0, 3).map((attendee) => (
                              <div
                                key={attendee.user_id}
                                className="w-6 h-6 rounded-full bg-black/10 border-2 border-white flex items-center justify-center text-[10px] font-medium text-black/50"
                              >
                                {attendee.user?.profile_img ? (
                                  <img
                                    src={attendee.user.profile_img}
                                    alt={attendee.user.nickname}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  attendee.user?.nickname?.charAt(0) || "?"
                                )}
                              </div>
                            ))}
                          </div>
                          {event.attendees.length > 3 && (
                            <span className="text-xs text-black/40 ml-1">
                              +{event.attendees.length - 3}명
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-black/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-black/40 mb-4">이 날짜에 일정이 없습니다</p>
              <button
                onClick={() => openCreateModal()}
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-black/80 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                일정 추가
              </button>
            </div>
          )}
        </div>

        {/* Quick Add */}
        <div className="p-4 border-t border-black/5">
          <button
            onClick={() => openCreateModal()}
            className="w-full py-3 border-2 border-dashed border-black/10 rounded-xl text-black/40 hover:border-black/20 hover:text-black/60 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">새 일정 만들기</span>
          </button>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-black mb-4">새 일정 만들기</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black/60 mb-1">제목</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="일정 제목"
                  className="w-full px-4 py-3 border border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 text-black"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black/60 mb-1">설명</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="일정 설명 (선택)"
                  rows={2}
                  className="w-full px-4 py-3 border border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 resize-none text-black"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAllDay"
                  checked={newEvent.isAllDay}
                  onChange={(e) => setNewEvent({ ...newEvent, isAllDay: e.target.checked })}
                  className="w-4 h-4 rounded border-black/20"
                />
                <label htmlFor="isAllDay" className="text-sm text-black/60">종일</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black/60 mb-1">시작 날짜</label>
                  <input
                    type="date"
                    value={newEvent.startDate}
                    onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value, endDate: e.target.value })}
                    className="w-full px-4 py-3 border border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 text-black"
                  />
                </div>
                {!newEvent.isAllDay && (
                  <div>
                    <label className="block text-sm font-medium text-black/60 mb-1">시작 시간</label>
                    <input
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      className="w-full px-4 py-3 border border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 text-black"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black/60 mb-1">종료 날짜</label>
                  <input
                    type="date"
                    value={newEvent.endDate}
                    onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    className="w-full px-4 py-3 border border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 text-black"
                  />
                </div>
                {!newEvent.isAllDay && (
                  <div>
                    <label className="block text-sm font-medium text-black/60 mb-1">종료 시간</label>
                    <input
                      type="time"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                      className="w-full px-4 py-3 border border-black/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 text-black"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black/60 mb-2">색상</label>
                <div className="flex gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, color: color.value })}
                      className={`w-8 h-8 rounded-full ${color.value} ${newEvent.color === color.value ? "ring-2 ring-offset-2 ring-black" : ""
                        }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 text-black/60 hover:text-black transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={!newEvent.title.trim() || isCreating}
                className="flex-1 py-3 bg-black text-white rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50"
              >
                {isCreating ? "생성 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
