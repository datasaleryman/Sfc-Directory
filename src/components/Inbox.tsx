import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  RefreshCw, 
  Send, 
  Trash2, 
  Clock, 
  User, 
  Bell, 
  CheckCircle,
  MessageSquare,
  AlertCircle,
  Loader2,
  X,
  Users,
  MapPin
} from 'lucide-react';

interface SubmissionMessage {
  id: string;
  sender?: string;
  senderName?: string;
  fullName?: string;
  from?: string;
  message?: string;
  content?: string;
  body?: string;
  createdAt?: string;
  created_at?: string;
}

interface InboxProps {
  authToken: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onNewMessageReceived?: (msg: SubmissionMessage) => void;
  currentUser?: { username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null;
}

export const Inbox: React.FC<InboxProps> = ({ authToken, showToast, onNewMessageReceived, currentUser = null }) => {
  const [messages, setMessages] = useState<SubmissionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<SubmissionMessage | null>(null);

  // Compose Message states
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTargetType, setComposeTargetType] = useState<'user' | 'barangay' | 'all'>('user');
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeBarangay, setComposeBarangay] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Lists for dropdown selections
  const [usersList, setUsersList] = useState<any[]>([]);
  const [barangaysList, setBarangaysList] = useState<string[]>([]);

  const isSuperUser = React.useMemo(() => {
    if (!currentUser) return false;
    const roleUpper = (currentUser.role || '').toUpperCase();
    return ['MASTER ADMIN', 'IT', 'ADMIN', 'ADMINISTRATOR'].includes(roleUpper) || currentUser.username.toLowerCase() === 'admin';
  }, [currentUser]);

  // Fetch users and barangays for dropdowns if superuser
  useEffect(() => {
    if (isSuperUser && authToken) {
      // Fetch users
      fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Filter out system admin or just display all accounts
            setUsersList(data);
          }
        })
        .catch(err => console.error('Error fetching users:', err));

      // Fetch barangays
      fetch('/api/public/barangays')
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.barangays)) {
            setBarangaysList(data.barangays);
          }
        })
        .catch(err => console.error('Error fetching barangays:', err));
    }
  }, [isSuperUser, authToken]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeContent.trim()) {
      showToast('Please type a message body.', 'error');
      return;
    }

    let targetRecipient = '';
    let targetBarangay = '';

    if (composeTargetType === 'user') {
      if (!composeRecipient) {
        showToast('Please select a recipient account.', 'error');
        return;
      }
      targetRecipient = composeRecipient;
    } else if (composeTargetType === 'barangay') {
      if (!composeBarangay) {
        showToast('Please select a target Barangay folder.', 'error');
        return;
      }
      targetBarangay = composeBarangay;
    }

    try {
      setSendingMessage(true);
      const senderName = currentUser?.displayName || currentUser?.username || 'System Administrator';
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          sender: senderName,
          message: composeContent.trim(),
          recipient: targetRecipient,
          barangay: targetBarangay
        })
      });

      if (!res.ok) {
        throw new Error('Failed to send message.');
      }

      showToast('Message successfully dispatched & registered to Base44.', 'success');
      setComposeContent('');
      setComposeRecipient('');
      setComposeBarangay('');
      setIsComposeOpen(false);
      
      // Refresh message list
      fetchMessages(true);
    } catch (err: any) {
      showToast(err.message || 'Error dispatching message.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const fetchMessages = async (force = false) => {
    try {
      if (!force) setLoading(true);
      const res = await fetch(`/api/messages?force=${force}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch messages.');
      const data = await res.json();
      
      if (Array.isArray(data)) {
        // Sort descending by date
        const sorted = data.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
          const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
          return dateB - dateA;
        });

        // Check if there are any new messages that weren't in our previous state
        if (messages.length > 0 && onNewMessageReceived) {
          const existingIds = new Set(messages.map(m => m.id));
          // Identify newly added messages
          const newMsgs = sorted.filter(m => !existingIds.has(m.id));
          if (newMsgs.length > 0) {
            newMsgs.forEach(msg => {
              onNewMessageReceived(msg);
            });
          }
        }

        setMessages(sorted);
        if (sorted.length > 0 && !selectedMessage) {
          setSelectedMessage(sorted[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Set up continuous polling every 5 seconds to trigger real-time notifications/automation popup
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [authToken]);

  const getSender = (msg: any) => {
    return msg.sender || msg.senderName || msg.fullName || msg.from || 'Anonymous';
  };

  const getContent = (msg: any) => {
    return msg.message || msg.content || msg.body || 'No content';
  };

  const getDateStr = (msg: any) => {
    const d = msg.createdAt || msg.created_at;
    if (!d) return 'Just now';
    return new Date(d).toLocaleString();
  };

  const filteredMessages = messages.filter(msg => {
    const sender = getSender(msg).toLowerCase();
    const content = getContent(msg).toLowerCase();
    const query = searchQuery.toLowerCase();
    
    // Search query check
    const matchesSearch = sender.includes(query) || content.includes(query);
    if (!matchesSearch) return false;

    // Filter by account if user is not superadmin
    if (currentUser && !isSuperUser) {
      const usernameLower = currentUser.username.toLowerCase();
      const userBarangayLower = (currentUser.barangay || '').toLowerCase().trim();

      const senderLower = sender.toLowerCase();
      const recipientLower = ((msg as any).recipient || (msg as any).to || '').toLowerCase().trim();
      const msgBarangayLower = ((msg as any).barangay || '').toLowerCase().trim();
      const submittedByLower = ((msg as any).submittedBy || '').toLowerCase().trim();

      return (
        senderLower === usernameLower ||
        submittedByLower === usernameLower ||
        recipientLower === usernameLower ||
        (userBarangayLower && msgBarangayLower === userBarangayLower)
      );
    }
    return true;
  });

  return (
    <div className="bg-slate-50/50 rounded-2xl border border-slate-200/60 p-6 shadow-xs" id="inbox-page-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/60">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Mail className="w-5 h-5 text-teal-600" />
            Submission Inbox
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time messages synced directly with Base44 <span className="font-semibold text-slate-700">SubmissionMessage</span> table.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperUser && (
            <button
              onClick={() => setIsComposeOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-3xs cursor-pointer focus:outline-none"
            >
              <Send className="w-3.5 h-3.5" />
              Compose Message
            </button>
          )}
          <button
            onClick={() => fetchMessages(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl transition-all border border-slate-200 shadow-3xs cursor-pointer focus:outline-none disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left pane: Message list with Search */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search bar & list */}
          <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden shadow-3xs flex flex-col h-[520px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sender or message content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-400"
                />
              </div>
              <div className="text-[11px] font-bold text-slate-400 px-2 shrink-0">
                {filteredMessages.length} total
              </div>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filteredMessages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 py-12">
                  <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">No messages found</p>
                  <p className="text-[10px] text-slate-400 mt-1">Inbox is currently empty.</p>
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  const sender = getSender(msg);
                  const content = getContent(msg);
                  const firstLetter = sender.charAt(0).toUpperCase() || '?';

                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className={`p-4 transition-all cursor-pointer flex items-start gap-3.5 ${
                        isSelected 
                          ? 'bg-teal-50/40 border-l-4 border-teal-500' 
                          : 'hover:bg-slate-50/60 border-l-4 border-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 font-extrabold text-xs shrink-0 select-none">
                        {firstLetter}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-black text-slate-800 truncate">
                            {sender}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                            {getDateStr(msg).split(',')[0]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium">
                          {content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right pane: Message details viewer */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6 h-[520px] flex flex-col shadow-3xs relative overflow-hidden">
            {selectedMessage ? (
              <div className="flex-1 flex flex-col">
                <div className="pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 font-black text-sm select-none">
                      {getSender(selectedMessage).charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">
                        {getSender(selectedMessage)}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {getDateStr(selectedMessage)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 py-6 overflow-y-auto">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Message Body
                  </h4>
                  <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4 text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {getContent(selectedMessage)}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 bg-white flex justify-between items-center">
                  <span className="text-[11px] text-slate-400 font-bold">
                    Read-only submission record
                  </span>
                  <div className="flex items-center gap-2 text-[11px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Verified Submission Message
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-12">
                <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  No Message Selected
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Choose a message from the list to view its contents.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Message Modal Overlay */}
      {isComposeOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Compose Dispatch / Message
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendMessage} className="p-6 space-y-5">
              {/* Target Type selector tabs */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Recipient Mode / Target
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setComposeTargetType('user');
                      setComposeBarangay('');
                    }}
                    className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all ${
                      composeTargetType === 'user'
                        ? 'bg-white text-teal-700 shadow-3xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    User Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposeTargetType('barangay');
                      setComposeRecipient('');
                    }}
                    className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all ${
                      composeTargetType === 'barangay'
                        ? 'bg-white text-teal-700 shadow-3xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Barangay Group
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposeTargetType('all');
                      setComposeRecipient('');
                      setComposeBarangay('');
                    }}
                    className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all ${
                      composeTargetType === 'all'
                        ? 'bg-white text-teal-700 shadow-3xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Broadcast (All)
                  </button>
                </div>
              </div>

              {/* Recipient Selection depending on Target Type */}
              {composeTargetType === 'user' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3 text-teal-600" />
                    Target User Account
                  </label>
                  <select
                    value={composeRecipient}
                    onChange={(e) => setComposeRecipient(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-500 transition-colors"
                  >
                    <option value="">-- Choose Account --</option>
                    {usersList.map((user) => (
                      <option key={user.username} value={user.username}>
                        {user.displayName || user.username} ({user.role})
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 font-medium">
                    This message will automatically be detected and display ONLY in the selected account's inbox.
                  </p>
                </div>
              )}

              {composeTargetType === 'barangay' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-600" />
                    Target Barangay Group
                  </label>
                  <select
                    value={composeBarangay}
                    onChange={(e) => setComposeBarangay(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-500 transition-colors"
                  >
                    <option value="">-- Choose Barangay Folder --</option>
                    {barangaysList.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 font-medium">
                    This message will automatically display for all user accounts assigned to the selected Barangay.
                  </p>
                </div>
              )}

              {composeTargetType === 'all' && (
                <div className="p-3 bg-teal-50/50 border border-teal-100 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-teal-700 font-medium leading-relaxed">
                    This is a global broadcast. The message will automatically display on the inbox of all administrators, superusers, and staff members across all locations.
                  </p>
                </div>
              )}

              {/* Message Content */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Message Body
                </label>
                <textarea
                  placeholder="Type message content..."
                  value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-500 transition-colors placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingMessage}
                  className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-3xs cursor-pointer focus:outline-none disabled:opacity-50"
                >
                  {sendingMessage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Dispatch Message
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
