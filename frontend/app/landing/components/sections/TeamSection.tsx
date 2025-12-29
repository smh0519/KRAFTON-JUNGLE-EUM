"use client";

import { forwardRef } from "react";
import { teamMembers } from "../../data";

interface TeamSectionProps {
  teamStep: number;
}

export const TeamSection = forwardRef<HTMLElement, TeamSectionProps>(
  function TeamSection({ teamStep }, ref) {
    return (
      <section
        ref={ref}
        className="min-h-screen snap-start snap-always flex bg-black overflow-hidden"
      >
        {teamMembers.map((member, index) => {
          const memberAppearStep = 5 - index;
          const isVisible = teamStep >= memberAppearStep;

          return (
            <div
              key={index}
              className="flex-1 h-screen relative overflow-hidden"
              style={{
                transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
                opacity: isVisible ? 1 : 0,
                transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1)`,
                transitionDelay: `${index * 50}ms`,
              }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${member.image})`, filter: 'grayscale(30%)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: member.color }}
              />

              <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center text-center">
                {member.isLeader && (
                  <div
                    className="mb-3 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: member.color, color: 'white' }}
                  >
                    TEAM LEADER
                  </div>
                )}
                <div
                  className="mb-2 px-3 py-1 rounded-full text-xs font-medium tracking-wider"
                  style={{
                    backgroundColor: `${member.color}20`,
                    color: member.color,
                    border: `1px solid ${member.color}40`,
                  }}
                >
                  {member.role}
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{member.name}</h3>
                <div
                  className="w-8 h-0.5 rounded-full mt-2"
                  style={{ backgroundColor: member.color }}
                />
              </div>

              <div
                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: `${member.color}10` }}
              />
            </div>
          );
        })}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`transition-all duration-1000 ${teamStep >= 5 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{ transitionDelay: '500ms' }}
          >
            <div className="bg-black/60 backdrop-blur-md rounded-2xl px-8 py-6 flex flex-col items-center">
              <img src="/logo_white.png" className="h-16 w-auto mb-3" alt="Eum" />
              <span className="text-white/80 text-sm font-bold tracking-widest">이음</span>
            </div>
          </div>
        </div>
      </section>
    );
  }
);
