'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRole, canGerer } from '@/lib/role';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Plus, Send, ArrowLeft, Users } from 'lucide-react';

interface ChatUser {
  id: number;
  name: string;
  role?: string;
}

interface ChatMessage {
  id: number;
  user_id: number;
  message: string;
  type: string;
  created_at: string;
  user?: { id: number; name: string };
}

interface Conversation {
  id: number;
  titre: string;
  type: string;
  statut: string;
  updated_at: string;
  participants?: ChatUser[];
  dernier_message?: ChatMessage | null;
  messages_non_lus?: number;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatUser[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [staff, setStaff] = useState<ChatUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const peutCreer = canGerer(user, getEffectiveRole(user));
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const chargerConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/chat');
      if (res.ok) {
        const json = await res.json();
        setConversations(Array.isArray(json?.data) ? json.data : []);
      }
    } catch {
      // silencieux : le polling retentera
    }
  }, []);

  const chargerConversation = useCallback(async (id: number) => {
    try {
      const res = await apiFetch(`/chat/${id}`);
      if (res.ok) {
        const conv = await res.json();
        setMessages(Array.isArray(conv?.messages) ? conv.messages : []);
        setParticipants(Array.isArray(conv?.participants) ? conv.participants : []);
      }
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    chargerConversations();
    const t = setInterval(chargerConversations, 6000);
    return () => clearInterval(t);
  }, [chargerConversations]);

  useEffect(() => {
    if (activeId === null) return;
    chargerConversation(activeId);
    const t = setInterval(() => chargerConversation(activeId), 5000);
    return () => clearInterval(t);
  }, [activeId, chargerConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const envoyer = async () => {
    if (!activeId || !draft.trim() || sending) return;
    const contenu = draft.trim();
    setSending(true);
    try {
      const res = await apiFetch(`/chat/${activeId}/message`, {
        method: 'POST',
        body: JSON.stringify({ message: contenu }),
      });
      if (res.ok) {
        setDraft('');
        await chargerConversation(activeId);
        await chargerConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const ouvrirNouvelleDiscussion = async () => {
    setShowNewDialog(true);
    setSelectedIds([]);
    try {
      const res = await apiFetch('/users');
      if (res.ok) {
        const json = await res.json();
        const liste: ChatUser[] = Array.isArray(json) ? json : (json?.data ?? []);
        setStaff(liste.filter((u) => u.id !== user?.id));
      }
    } catch {
      setStaff([]);
    }
  };

  const creerDiscussion = async () => {
    if (selectedIds.length === 0) return;
    const autres = selectedIds.map((id) => staff.find((s) => s.id === id)?.name ?? '').filter(Boolean);
    const titre =
      autres.length === 1 ? autres[0] : `Groupe (${autres.length + 1} membres)`;

    const res = await apiFetch('/chat', {
      method: 'POST',
      body: JSON.stringify({
        titre,
        type: autres.length === 1 ? 'prive' : 'groupe',
        participant_ids: selectedIds,
      }),
    });

    if (res.ok) {
      setShowNewDialog(false);
      await chargerConversations();
      const json = await res.json();
      if (json?.data?.id) setActiveId(json.data.id);
    }
  };

  const initiale = (nom?: string) => (nom ?? '?').charAt(0).toUpperCase();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Discussions internes de votre boutique
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        {/* Liste des conversations */}
        <div className="border border-border rounded-2xl bg-card/60 overflow-hidden flex flex-col h-[70vh]">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Discussions</span>
            {peutCreer && (
              <Button size="sm" variant="secondary" onClick={ouvrirNouvelleDiscussion}>
                <Plus className="w-4 h-4 mr-1" /> Nouvelle
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Aucune discussion pour le moment.
              </p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left p-3 flex items-center gap-3 border-b border-border/50 transition-colors hover:bg-muted/50 ${
                  c.id === activeId ? 'bg-orange-500/10' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {c.type === 'groupe' ? <Users className="w-4 h-4" /> : initiale(c.titre)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.titre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.dernier_message?.message ?? '—'}
                  </p>
                </div>
                {(c.messages_non_lus ?? 0) > 0 && (
                  <Badge className="bg-orange-500 hover:bg-orange-500 shrink-0">
                    {c.messages_non_lus}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fil de discussion */}
        <div className="border border-border rounded-2xl bg-card/60 flex flex-col h-[70vh] overflow-hidden">
          {activeConversation === null ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Sélectionnez une discussion
            </div>
          ) : (
            <>
              <div className="md:hidden p-3 border-b border-border">
                <Button size="sm" variant="ghost" onClick={() => setActiveId(null)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                </Button>
              </div>
              <div className="p-3 border-b border-border">
                <p className="font-medium text-sm">{activeConversation.titre}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {participants.map((p) => p.name).join(', ')}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => {
                  const mine = m.user_id === user?.id;
                  if (m.type === 'systeme') {
                    return (
                      <p key={m.id} className="text-center text-xs text-muted-foreground py-1">
                        {m.message}
                      </p>
                    );
                  }
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                          mine
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {!mine && (
                          <p className="text-xs font-semibold opacity-80 mb-0.5">
                            {m.user?.name ?? 'Membre'}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                        <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'opacity-60'}`}>
                          {new Date(m.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-border flex items-center gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      envoyer();
                    }
                  }}
                  placeholder="Écrire un message…"
                  disabled={sending}
                />
                <Button onClick={envoyer} disabled={sending || !draft.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogue nouvelle discussion */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
            <div>
              <h2 className="font-bold">Nouvelle discussion</h2>
              <p className="text-sm text-muted-foreground">
                Choisissez les membres de votre équipe.
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {staff.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun autre membre trouvé.</p>
              )}
              {staff.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s.id)}
                    onChange={(e) =>
                      setSelectedIds((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                      )
                    }
                    className="accent-orange-500"
                  />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold">
                    {initiale(s.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{s.role}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowNewDialog(false)}>
                Annuler
              </Button>
              <Button onClick={creerDiscussion} disabled={selectedIds.length === 0}>
                Créer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
