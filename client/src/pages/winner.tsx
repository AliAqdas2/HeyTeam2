import React, { useState, useEffect } from 'react';
import { Trophy, Users, Code, Gift, ChevronDown, ChevronUp, ExternalLink, Github, Award, Star } from 'lucide-react';

const Winner = () => {
  const [progress, setProgress] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const [showCopyPasteAnimation, setShowCopyPasteAnimation] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [pastedText, setPastedText] = useState(false);
  const [showTeamName, setShowTeamName] = useState(false);

  // Winner data
  const winner = {
    teamName: "CTRLC+V",
    members: ["Muhammad Azfar", "Muhammad Sohail Hafeez", "Ibrahim Sheikh"],
    projectName: "RealTime Video Chat Translation",
    description: "A video calling platform enhanced with AI-powered real-time captions and multilingual translation. The system converts speech to live text during the call and instantly translates it into a user-selected language, enabling seamless communication between people who speak different languages.",
    prize: "15,000 PKR",
    category: "Best AI Implementation",
    repoLink: "https://github.com/mibrahimm1/code_connect",
    demoLink: "https://code-connect-rose.vercel.app/",
    logoEmoji: "🏆"
  };

  // Confetti effect and copy-paste animation
  useEffect(() => {
    if (isRevealed) {
      // Show copy-paste animation first
      setShowCopyPasteAnimation(true);
      
      // Simulate copying - wait for user to see selection
      setTimeout(() => {
        setCopiedText(winner.teamName);
      }, 2500);
      
      // Show pasted text - after paste popup appears (2.5s copiedText + 3.5s paste popup = 6s, add 1s = 7s)
      setTimeout(() => {
        setPastedText(true);
      }, 7000);
      
      // Show team name - wait until paste animation fully completes (text pasted at 7s, add 2s for animation = 9s)
      setTimeout(() => {
        setShowTeamName(true);
      }, 9000);
      
      // Start confetti right after winner card appears
      setTimeout(() => {
        setShowConfetti(true);
      }, 9500);
      
      const timer = setTimeout(() => setShowConfetti(false), 14500);
      return () => clearTimeout(timer);
    }
  }, [isRevealed, winner.teamName]);

  const handleMouseDown = () => {
    setIsCharging(true);
  };

  const handleMouseUp = () => {
    setIsCharging(false);
    if (progress >= 100) {
      setIsRevealed(true);
    }
    setProgress(0);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isCharging && !isRevealed) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setIsCharging(false);
            setIsRevealed(true);
            return 100;
          }
          return prev + 2;
        });
      }, 20);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCharging, isRevealed]);

  // Confetti Component
  const Confetti = () => {
    const confettiPieces = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][Math.floor(Math.random() * 5)]
    }));

    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {confettiPieces.map(piece => (
          <div
            key={piece.id}
            className="absolute w-2 h-2 md:w-3 md:h-3 opacity-0 rounded-sm"
            style={{
              left: `${piece.left}%`,
              top: '-10%',
              backgroundColor: piece.color,
              animation: `confettiFall ${piece.duration}s ease-out ${piece.delay}s forwards`,
              transform: 'rotate(0deg)'
            }}
          />
        ))}
        <style>{`
          @keyframes confettiFall {
            0% { 
              top: -10%; 
              opacity: 1;
              transform: rotate(0deg) translateY(0);
            }
            100% { 
              top: 110%; 
              opacity: 0;
              transform: rotate(${Math.random() * 720}deg) translateY(20px);
            }
          }
        `}</style>
      </div>
    );
  };

  if (!isRevealed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
        </div>

        <div className="text-center space-y-12 z-10 max-w-2xl">
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Star className="w-8 h-8 text-blue-400" />
              <Star className="w-10 h-10 text-blue-500" />
              <Star className="w-8 h-8 text-blue-400" />
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tight">
              CODE CONNECT
            </h1>
            
            <div className="inline-block bg-blue-500 text-white px-6 py-2 text-sm font-semibold tracking-wider uppercase">
              Hackathon Winner 2025
            </div>
          </div>

          <p className="text-lg text-slate-300 animate-fadeIn font-medium" style={{ animationDelay: '0.3s' }}>
            Press and hold the trophy to reveal the champion
          </p>
          
          {/* Interactive Reveal Button */}
          <div className="relative inline-block animate-fadeIn" style={{ animationDelay: '0.5s' }}>
            <button
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              className="relative group"
              aria-label="Press and hold to reveal winner"
              aria-live="polite"
              aria-pressed={isCharging}
            >
              <div className="relative w-64 h-64 md:w-80 md:h-80">
                {/* Progress circle background */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.2)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
                    strokeDashoffset={2 * Math.PI * 45 * (1 - progress / 100)}
                    style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                  />
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`transition-all duration-300 ${isCharging ? 'scale-110' : 'scale-100'}`}>
                    <div className="relative">
                      <Trophy 
                        className={`w-32 h-32 md:w-40 md:h-40 transition-all duration-300 ${
                          isCharging 
                            ? 'text-amber-400' 
                            : 'text-slate-600'
                        }`}
                        style={{
                          fill: isCharging ? `rgba(251, 191, 36, ${progress / 100})` : 'none',
                          filter: isCharging ? 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.5))' : 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Progress text */}
                {isCharging && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl md:text-5xl font-black text-white">
                      {Math.round(progress)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Hint text */}
              <div className="mt-8">
                <div className={`inline-block px-6 py-3 rounded-lg transition-all duration-300 ${
                  isCharging 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  <p className="text-sm font-semibold">
                    {isCharging ? 'Keep holding...' : 'Press & Hold'}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
        
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 1s ease-out forwards;
            opacity: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 relative overflow-hidden">
      {showConfetti && <Confetti />}
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Copy-Paste Animation Overlay - iPhone Style */}
      {showCopyPasteAnimation && !showTeamName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl">
            
            {/* Guessing Game Header */}
            <div className="text-center mb-12 animate-fadeIn">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                🤔 Can you guess the winner?
              </h2>
              <p className="text-xl text-slate-300 mb-6">
                Based on this hint...
              </p>
              
              {/* Other team names */}
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <div className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold">brain.cpp</div>
                <div className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold">boys</div>
                <div className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold">Bug Hunters</div>
                <div className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold">MMA</div>
                <div className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold">CTRL C + V</div>
              </div>
            </div>
            
            {/* iPhone-style text selection */}
            <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-visible">
              {/* Some context text */}
              <div className="text-gray-600 text-xl md:text-2xl mb-6 leading-relaxed">
                The winning team is known for their legendary coding skills...
              </div>
              
              {/* The text being selected */}
              <div className="relative inline-block my-4">
                <div className={`text-4xl md:text-6xl font-black transition-all duration-700 ${
                  copiedText ? 'bg-blue-400 text-white' : 'text-slate-800'
                } px-3 py-2 rounded-lg font-mono`}>
                  Winner
                </div>
                
                {/* Selection handles (lollipops) */}
                {copiedText && (
                  <>
                    {/* Left handle */}
                    <div className="absolute -left-3 top-0 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
                      <div className="w-1 h-full bg-blue-500"></div>
                      <div className="w-5 h-5 bg-blue-500 rounded-full -ml-2 shadow-lg"></div>
                    </div>
                    
                    {/* Right handle */}
                    <div className="absolute -right-3 bottom-0 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
                      <div className="w-5 h-5 bg-blue-500 rounded-full -mr-2 shadow-lg"></div>
                      <div className="w-1 h-full bg-blue-500"></div>
                    </div>
                    
                    {/* Copy popup menu */}
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 animate-popIn" style={{ animationDelay: '0.5s' }}>
                      <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                        <button className="px-10 py-5 text-white text-lg font-semibold hover:bg-slate-700 transition-colors">
                          Copy
                        </button>
                      </div>
                      {/* Arrow pointing down */}
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 rotate-45"></div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="text-gray-600 text-xl md:text-2xl mt-6 leading-relaxed">
                ...they always find the perfect solution! 😉
              </div>
            </div>

            {/* Copied notification */}
            {copiedText && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 animate-slideDown z-10" style={{ animationDelay: '1.5s' }}>
                <div className="bg-slate-800 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3">
                  <span className="text-2xl">✓</span>
                  <span className="font-semibold text-lg">Copied</span>
                </div>
              </div>
            )}

            {/* Paste destination - appears after copy */}
            {copiedText && (
              <div className="mt-8 animate-fadeIn" style={{ animationDelay: '2.5s' }}>
                <div className="bg-slate-100 rounded-3xl p-8 md:p-12 shadow-2xl relative">
                  <div className="text-gray-500 text-xl md:text-2xl mb-6 font-semibold">
                    🏆 Winner Name:
                  </div>
                  
                  {/* Blinking cursor before paste, then pasted text */}
                  <div className="relative">
                    {!pastedText ? (
                      <div className="text-4xl md:text-5xl font-black text-slate-400">
                        <span className="animate-blink">|</span>
                      </div>
                    ) : (
                      <div className="text-4xl md:text-5xl font-black text-slate-800 animate-fadeIn">
                        {winner.teamName}
                      </div>
                    )}
                    
                    {/* Paste popup menu */}
                    <div className="absolute -top-24 left-4 animate-popIn" style={{ animationDelay: '3.5s', display: pastedText ? 'none' : 'block' }}>
                      <div className="bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                        <button className="px-10 py-5 text-white text-lg font-semibold hover:bg-slate-700 transition-colors">
                          Paste
                        </button>
                      </div>
                      {/* Arrow pointing down */}
                      <div className="absolute -bottom-2 left-10 w-4 h-4 bg-slate-800 rotate-45"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div 
        className={`max-w-5xl mx-auto relative z-10 transition-all duration-1000 ${
          showTeamName ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        role="region"
        aria-live="polite"
        aria-label="Winner announcement"
      >
        {/* Winner Card */}
        <div className="relative">
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header Section */}
            <div className="relative bg-blue-600 p-12 text-center">
              <div className="relative z-10">
                <div className="flex justify-center mb-6">
                  <div className="relative bg-white rounded-full p-6 shadow-xl">
                    <div className="text-6xl animate-bounce" style={{ animationDuration: '2s' }}>
                      {winner.logoEmoji}
                    </div>
                  </div>
                </div>
                
                <div className="inline-block px-5 py-2 bg-white/20 backdrop-blur-sm rounded-lg mb-4 border border-white/30">
                  <span className="text-white font-semibold text-sm tracking-wide uppercase flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    {winner.category}
                  </span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-black text-white mb-3 tracking-tight font-mono">
                  {winner.teamName}
                </h1>
                
                <p className="text-2xl md:text-3xl text-blue-100 font-semibold">{winner.projectName}</p>
              </div>
            </div>

            {/* Prize Section */}
            <div className="bg-emerald-500 py-8 px-8 text-center relative">
              <div className="relative z-10">
                <p className="text-emerald-100 text-sm font-semibold mb-2 uppercase tracking-wider">Grand Prize</p>
                <div className="flex items-center justify-center gap-4">
                  <Gift className="w-10 h-10 text-white" />
                  <span className="text-5xl md:text-6xl font-black text-white">
                    {winner.prize}
                  </span>
                </div>
              </div>
            </div>

            {/* Team Members Section */}
            <div className="p-8 space-y-6 bg-slate-50">
              <button
                onClick={() => setShowMembers(!showMembers)}
                className="w-full flex items-center justify-between bg-white hover:bg-slate-50 transition-all duration-300 rounded-xl p-5 group border-2 border-slate-200 hover:border-blue-400"
                aria-expanded={showMembers}
                aria-controls="team-members"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-2xl font-bold text-slate-800">Team Members</span>
                  <span className="text-sm text-slate-500 bg-slate-200 px-3 py-1 rounded-full font-semibold">{winner.members.length}</span>
                </div>
                {showMembers ? (
                  <ChevronUp className="w-6 h-6 text-blue-600" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-blue-600" />
                )}
              </button>

              {showMembers && (
                <div 
                  id="team-members"
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {winner.members.map((member, index) => (
                    <div
                      key={index}
                      className="bg-white border-2 border-slate-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all duration-300 animate-fadeIn"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-black text-xl shadow-md">
                          {member[0]}
                        </div>
                        <span className="text-slate-800 font-semibold text-lg">{member}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Project Details */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between bg-white hover:bg-slate-50 transition-all duration-300 rounded-xl p-5 group border-2 border-slate-200 hover:border-blue-400"
                aria-expanded={showDetails}
                aria-controls="project-details"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Code className="w-6 h-6 text-amber-600" />
                  </div>
                  <span className="text-2xl font-bold text-slate-800">Project Details</span>
                </div>
                {showDetails ? (
                  <ChevronUp className="w-6 h-6 text-blue-600" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-blue-600" />
                )}
              </button>

              {showDetails && (
                <div id="project-details" className="space-y-4 animate-fadeIn">
                  <div className="bg-white border-2 border-slate-200 rounded-xl p-6">
                    <p className="text-slate-700 leading-relaxed text-lg">
                      {winner.description}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <a
                      href={winner.repoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 hover:shadow-lg group"
                      aria-label="View GitHub repository"
                    >
                      <Github className="w-6 h-6" />
                      <span className="text-lg">View Code</span>
                      <ExternalLink className="w-5 h-5" />
                    </a>
                    
                    <a
                      href={winner.demoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 hover:shadow-lg group"
                      aria-label="View live demo"
                    >
                      <ExternalLink className="w-6 h-6" />
                      <span className="text-lg">Live Demo</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-100 px-8 py-6 text-center border-t-2 border-slate-200">
              <p className="text-slate-800 text-xl font-bold mb-2">
                🎉 Congratulations to the Champions! 🎉
              </p>
              <p className="text-sm text-slate-600 font-medium">
                Code Connect Hackathon • NUST SEECS • 2025
              </p>
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsRevealed(false);
              setProgress(0);
              setShowCopyPasteAnimation(false);
              setCopiedText('');
              setPastedText(false);
              setShowTeamName(false);
            }}
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg"
            aria-label="Reset to reveal screen"
          >
            ↻ Reset Announcement
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(50px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .animate-slideUp {
          animation: slideUp 1s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 1s ease-out forwards;
          opacity: 0;
        }

        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .animate-popIn {
          animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideDown {
          animation: slideDown 0.4s ease-out forwards;
          opacity: 0;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </div>
  );
};

export default Winner;
