'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { GiChessKnight, GiChessKing } from 'react-icons/gi'
import { FiBook, FiTarget, FiSearch, FiChevronLeft, FiRefreshCw, FiChevronRight, FiChevronDown, FiChevronUp, FiMenu, FiX, FiDownload, FiSmartphone } from 'react-icons/fi'
import { HiOutlineLightBulb } from 'react-icons/hi'
import { BiAnalyse } from 'react-icons/bi'

// ─── Agent IDs ───────────────────────────────────────────────────────────────

const CHESS_ANALYSIS_AGENT = '699a5377e09fdeca7d4926a6'
const OPENING_TRAINER_AGENT = '699a5377c0717306350423ee'
const TACTICS_COACH_AGENT = '699a5377c0717306350423f0'

// ─── TypeScript Interfaces ───────────────────────────────────────────────────

interface BestMove {
  move: string
  evaluation: string
  explanation: string
}

interface MoveClassification {
  move_number: string
  classification: string
  comment: string
  best_alternative: string
}

interface ChessAnalysis {
  analysis_type: string
  position_evaluation: string
  best_moves: BestMove[]
  strategic_themes: string[]
  move_classifications: MoveClassification[]
  summary: string
  material_balance: string
  key_weaknesses: string[]
}

interface KeyVariation {
  variation_name: string
  moves: string
  explanation: string
}

interface OpeningData {
  opening_name: string
  eco_code: string
  current_position_fen: string
  current_move: string
  move_explanation: string
  main_line: string[]
  key_variations: KeyVariation[]
  strategic_plans: string[]
  typical_mistakes: string[]
  next_prompt: string
  user_move_feedback: string
}

interface PuzzleData {
  puzzle_fen: string
  side_to_move: string
  difficulty: string
  tactical_theme: string
  puzzle_prompt: string
  solution: string[]
  solution_explanation: string
  hints: string[]
  user_answer_feedback: string
  is_correct: boolean
  pattern_lesson: string
  next_action: string
}

interface PuzzleStats {
  streak: number
  total: number
  correct: number
}

interface OpeningCardData {
  name: string
  eco: string
  difficulty: string
  color: string
  description: string
}

type Section = 'jogar' | 'aberturas' | 'puzzles' | 'revisao'

// ─── Chess Logic ─────────────────────────────────────────────────────────────

const PIECES: Record<string, string> = {
  'K': '\u2654', 'Q': '\u2655', 'R': '\u2656', 'B': '\u2657', 'N': '\u2658', 'P': '\u2659',
  'k': '\u265A', 'q': '\u265B', 'r': '\u265C', 'b': '\u265D', 'n': '\u265E', 'p': '\u265F'
}

function parseFEN(fen: string): string[][] {
  if (!fen) return Array(8).fill(null).map(() => Array(8).fill(''))
  const rows = fen.split(' ')[0]?.split('/') ?? []
  return rows.map(row => {
    const squares: string[] = []
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        for (let i = 0; i < parseInt(char); i++) squares.push('')
      } else {
        squares.push(char)
      }
    }
    while (squares.length < 8) squares.push('')
    return squares
  })
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

// ─── Sample Data ─────────────────────────────────────────────────────────────

const SAMPLE_ANALYSIS: ChessAnalysis = {
  analysis_type: 'fen_analysis',
  position_evaluation: '+1.2',
  best_moves: [
    { move: 'Nf3', evaluation: '+1.4', explanation: 'Desenvolve o cavalo para uma casa ativa, controlando o centro e preparando o roque.' },
    { move: 'e4', evaluation: '+1.1', explanation: 'Avancar o peao central abre linhas para o bispo e a dama.' },
    { move: 'Bc4', evaluation: '+0.9', explanation: 'Bispo mira f7, o ponto mais fraco na posicao preta.' }
  ],
  strategic_themes: ['Controle do centro', 'Desenvolvimento', 'Seguranca do rei', 'Coluna aberta'],
  move_classifications: [],
  summary: 'Brancas possuem vantagem posicional com melhor desenvolvimento e controle central. A chave eh completar o desenvolvimento e pressionar o centro.',
  material_balance: 'Material igual',
  key_weaknesses: ['Peao isolado em d5', 'Rei preto no centro', 'Casa f7 vulneravel']
}

const SAMPLE_OPENING: OpeningData = {
  opening_name: 'Defesa Siciliana',
  eco_code: 'B20',
  current_position_fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
  current_move: '1...c5',
  move_explanation: 'A Defesa Siciliana eh a resposta mais popular e ambiciosa contra 1.e4. As pretas lutam por contra-jogo no lado da dama desde o inicio.',
  main_line: ['1.e4 c5', '2.Nf3 d6', '3.d4 cxd4', '4.Nxd4 Nf6', '5.Nc3 a6'],
  key_variations: [
    { variation_name: 'Variante Najdorf', moves: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6', explanation: 'A variante mais popular e agressiva da Siciliana. As pretas mantem maxima flexibilidade.' },
    { variation_name: 'Variante Dragao', moves: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6', explanation: 'As pretas fianchetam o bispo no lado do rei, criando pressao na diagonal longa.' }
  ],
  strategic_plans: [
    'Contra-jogo no lado da dama com a-b5',
    'Controle da casa d5',
    'Pressao na coluna c semi-aberta',
    'Atividade de pecas menores no centro'
  ],
  typical_mistakes: [
    'Jogar d5 prematuramente sem preparo adequado',
    'Negligenciar o desenvolvimento do lado do rei',
    'Trocar o bispo de casas escuras cedo demais'
  ],
  next_prompt: 'Qual jogada voce faria como brancas agora? (Dica: desenvolva o cavalo do rei)',
  user_move_feedback: ''
}

const SAMPLE_PUZZLE: PuzzleData = {
  puzzle_fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
  side_to_move: 'white',
  difficulty: 'beginner',
  tactical_theme: 'Mate em 2',
  puzzle_prompt: 'Brancas jogam e dao mate em 2 lances. Encontre a sequencia!',
  solution: ['Qxf7#'],
  solution_explanation: 'A dama captura em f7 dando xeque-mate. O rei preto nao tem casas de fuga: e7 eh bloqueada pelo peao, e d8/f8 pelo proprio bispo e torre.',
  hints: ['Observe a diagonal do bispo em c4', 'O ponto f7 esta desprotegido'],
  user_answer_feedback: '',
  is_correct: false,
  pattern_lesson: 'O mate do Pastor eh um dos padroes mais basicos. A combinacao de dama e bispo atacando f7 (ou f2 para pretas) eh um tema recorrente nas aberturas.',
  next_action: 'new_puzzle'
}

const SAMPLE_REVIEW: ChessAnalysis = {
  analysis_type: 'pgn_analysis',
  position_evaluation: '+0.3',
  best_moves: [
    { move: 'Nf3', evaluation: '+0.5', explanation: 'Melhor continuacao, mantendo controle central.' }
  ],
  strategic_themes: ['Controle central', 'Desenvolvimento', 'Estrutura de peoes'],
  move_classifications: [
    { move_number: '1. e4', classification: 'excellent', comment: 'Excelente abertura, ocupa o centro.', best_alternative: '' },
    { move_number: '1...e5', classification: 'good', comment: 'Boa resposta simetrica.', best_alternative: '' },
    { move_number: '2. Nf3', classification: 'excellent', comment: 'Desenvolve peca atacando e5.', best_alternative: '' },
    { move_number: '2...Nc6', classification: 'good', comment: 'Defende e5 naturalmente.', best_alternative: '' },
    { move_number: '3. Bc4', classification: 'good', comment: 'Bispo italiano, ataca f7.', best_alternative: 'Bb5' },
    { move_number: '4. d3', classification: 'inaccuracy', comment: 'Passiva. Melhor seria d4 imediatamente.', best_alternative: 'd4' },
    { move_number: '5. Bg5', classification: 'mistake', comment: 'Prematuro, perde tempo apos h6.', best_alternative: 'O-O' },
    { move_number: '6. Bh4', classification: 'blunder', comment: 'Perde material apos g5 seguido de Nxe4.', best_alternative: 'Be3' }
  ],
  summary: 'Partida com bom inicio mas erros crescentes no meio-jogo. As brancas desperdicaram a vantagem de desenvolvimento com jogadas de bispo imprecisas. Foco recomendado: completar desenvolvimento antes de atacar.',
  material_balance: 'Brancas com -1 peao',
  key_weaknesses: ['Bispo deslocado em h4', 'Roque atrasado', 'Centro enfraquecido apos d3']
}

// ─── Opening Catalog ─────────────────────────────────────────────────────────

const OPENINGS_CATALOG: OpeningCardData[] = [
  { name: 'Defesa Siciliana', eco: 'B20-B99', difficulty: 'Avancado', color: 'Pretas', description: 'A defesa mais agressiva contra 1.e4. Luta por contra-jogo assimetrico desde o primeiro lance.' },
  { name: 'Ruy Lopez', eco: 'C60-C99', difficulty: 'Intermediario', color: 'Brancas', description: 'Abertura classica espanhola. Pressiona o centro e o cavalo em c6 com o bispo.' },
  { name: 'Gambito da Dama', eco: 'D06-D69', difficulty: 'Intermediario', color: 'Brancas', description: 'Sacrifica um peao para dominar o centro. Uma das aberturas mais solidas e estrategicas.' },
  { name: 'Defesa Francesa', eco: 'C00-C19', difficulty: 'Intermediario', color: 'Pretas', description: 'Defesa solida com e6. Cria uma estrutura de peoes resistente e contra-ataca no centro.' },
  { name: 'Defesa Caro-Kann', eco: 'B10-B19', difficulty: 'Iniciante', color: 'Pretas', description: 'Abertura solida e confiavel. Pretas desenvolvem sem bloquear o bispo de casas claras.' },
  { name: 'Abertura Inglesa', eco: 'A10-A39', difficulty: 'Avancado', color: 'Brancas', description: 'Abertura de flanco flexivel com c4. Controla d5 sem comprometer a estrutura central.' },
  { name: 'Italiana', eco: 'C50-C59', difficulty: 'Iniciante', color: 'Brancas', description: 'O Giuoco Piano mira f7 com o bispo. Excelente para iniciantes aprenderem principios.' },
  { name: 'Indiana do Rei', eco: 'E60-E99', difficulty: 'Avancado', color: 'Pretas', description: 'Defesa hipermoderna. Permite brancas ocuparem o centro para depois contra-atacar.' }
]

// ─── Markdown Renderer ───────────────────────────────────────────────────────

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">{part}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

// ─── Chess Board Component ───────────────────────────────────────────────────

function ChessBoard({ fen, size = 'normal' }: { fen: string; size?: 'normal' | 'small' }) {
  const board = parseFEN(fen)
  const squareSize = size === 'small' ? 'w-8 h-8 text-lg' : 'w-8 h-8 text-xl sm:w-10 sm:h-10 sm:text-2xl md:w-10 md:h-10 md:text-2xl lg:w-12 lg:h-12 lg:text-3xl'
  const rankHeight = size === 'small' ? 'h-8' : 'h-8 sm:h-10 md:h-10 lg:h-12'
  const fileWidth = size === 'small' ? 'w-8' : 'w-8 sm:w-10 md:w-10 lg:w-12'

  return (
    <div className="overflow-x-auto">
      <div className="inline-block border border-border">
        <div className="flex">
          <div className="flex flex-col justify-around pr-1">
            {RANKS.map(r => (
              <span key={r} className={`text-xs text-muted-foreground flex items-center justify-center w-4 ${rankHeight}`}>{r}</span>
            ))}
          </div>
          <div>
            {board.map((row, rowIdx) => (
              <div key={rowIdx} className="flex">
                {row.map((piece, colIdx) => {
                  const isLight = (rowIdx + colIdx) % 2 === 0
                  return (
                    <div
                      key={colIdx}
                      className={`${squareSize} flex items-center justify-center select-none ${isLight ? 'bg-[hsl(0_0%_25%)]' : 'bg-[hsl(0_0%_15%)]'}`}
                    >
                      {piece && PIECES[piece] ? (
                        <span className={piece === piece.toUpperCase() ? 'text-[hsl(0_0%_90%)]' : 'text-[hsl(0_70%_55%)]'}>
                          {PIECES[piece]}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))}
            <div className="flex">
              <div className="w-0" />
              {FILES.map(f => (
                <div key={f} className={`${fileWidth} text-center text-xs text-muted-foreground pt-1`}>{f}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Classification helpers ──────────────────────────────────────────────────

function classificationColor(classification: string): string {
  const c = classification?.toLowerCase() ?? ''
  if (c === 'excellent' || c === 'excelente') return 'bg-green-600 text-white'
  if (c === 'good' || c === 'boa' || c === 'bom') return 'bg-green-500/70 text-white'
  if (c === 'inaccuracy' || c === 'imprecisao') return 'bg-yellow-600 text-white'
  if (c === 'mistake' || c === 'erro') return 'bg-orange-600 text-white'
  if (c === 'blunder') return 'bg-red-600 text-white'
  return 'bg-muted text-muted-foreground'
}

function classificationLabel(classification: string): string {
  const c = classification?.toLowerCase() ?? ''
  if (c === 'excellent') return 'Excelente'
  if (c === 'good') return 'Boa'
  if (c === 'inaccuracy') return 'Imprecisao'
  if (c === 'mistake') return 'Erro'
  if (c === 'blunder') return 'Blunder'
  return classification ?? ''
}

function classificationSymbol(classification: string): string {
  const c = classification?.toLowerCase() ?? ''
  if (c === 'excellent' || c === 'excelente') return '!!'
  if (c === 'good' || c === 'boa' || c === 'bom') return '!'
  if (c === 'inaccuracy' || c === 'imprecisao') return '?!'
  if (c === 'mistake' || c === 'erro') return '?'
  if (c === 'blunder') return '??'
  return ''
}

function evalColor(evalStr: string): string {
  if (!evalStr) return 'bg-muted text-muted-foreground'
  const num = parseFloat(evalStr.replace('+', ''))
  if (isNaN(num)) return 'bg-muted text-muted-foreground'
  if (num > 0.5) return 'bg-green-700 text-white'
  if (num < -0.5) return 'bg-red-700 text-white'
  return 'bg-muted text-foreground'
}

function difficultyLabel(d: string): string {
  const dl = d?.toLowerCase() ?? ''
  if (dl === 'beginner') return 'Iniciante'
  if (dl === 'intermediate') return 'Intermediario'
  if (dl === 'advanced') return 'Avancado'
  if (dl === 'master') return 'Mestre'
  return d ?? ''
}

// ─── ErrorBoundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Algo deu errado</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground text-sm">
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ active, onNavigate, isOpen, onClose }: { active: Section; onNavigate: (s: Section) => void; isOpen: boolean; onClose: () => void }) {
  const items: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: 'jogar', label: 'Jogar', icon: <GiChessKing className="w-5 h-5" /> },
    { key: 'aberturas', label: 'Aberturas', icon: <FiBook className="w-5 h-5" /> },
    { key: 'puzzles', label: 'Puzzles', icon: <FiTarget className="w-5 h-5" /> },
    { key: 'revisao', label: 'Revisao', icon: <FiSearch className="w-5 h-5" /> },
  ]

  const handleNavClick = (key: Section) => {
    onNavigate(key)
    onClose()
  }

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`w-56 min-h-screen bg-[hsl(0_0%_7%)] border-r border-border flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GiChessKnight className="w-7 h-7 text-[hsl(0_70%_55%)]" />
            <h1 className="text-lg font-bold tracking-tight">ChessMaster AI</h1>
          </div>
          {/* Close button - only visible on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar menu"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {items.map(item => (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${active === item.key ? 'bg-[hsl(0_0%_12%)] text-[hsl(0_70%_55%)] border-l-2 border-[hsl(0_70%_55%)]' : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_10%)]'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground mb-2">Agentes Ativos</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500" />
              <span>Analise</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500" />
              <span>Aberturas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500" />
              <span>Taticas</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── PWA Install Banner ─────────────────────────────────────────────────────

function PWAInstallBanner({ installPrompt, onInstall, onDismiss }: { installPrompt: any; onInstall: () => void; onDismiss: () => void }) {
  if (!installPrompt) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:ml-56">
      <Card className="bg-card border-border shadow-2xl max-w-lg mx-auto">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 bg-[hsl(0_70%_55%)]/10 border border-[hsl(0_70%_55%)]/30 flex items-center justify-center">
              <FiSmartphone className="w-5 h-5 text-[hsl(0_70%_55%)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-1">Instale o ChessMaster AI no seu dispositivo</p>
              <p className="text-xs text-muted-foreground">Acesse rapidamente direto da tela inicial, mesmo offline.</p>
            </div>
            <button
              onClick={onDismiss}
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fechar"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button
              onClick={onInstall}
              size="sm"
              className="flex-1 bg-[hsl(0_70%_55%)] hover:bg-[hsl(0_70%_45%)] text-white gap-2"
            >
              <FiDownload className="w-4 h-4" />
              Instalar App
            </Button>
            <Button
              onClick={onDismiss}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              Agora nao
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Jogar Section ───────────────────────────────────────────────────────────

function JogarSection({ showSample }: { showSample: boolean }) {
  const [currentFen, setCurrentFen] = useState(INITIAL_FEN)
  const [fenInput, setFenInput] = useState('')
  const [moveInput, setMoveInput] = useState('')
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<ChessAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedColor, setSelectedColor] = useState<'white' | 'black' | 'random'>('white')
  const [difficulty, setDifficulty] = useState('10')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const displayAnalysis = showSample && !analysis ? SAMPLE_ANALYSIS : analysis

  const analyzePosition = useCallback(async () => {
    const fen = fenInput.trim() || currentFen
    if (!fen) return
    setLoading(true)
    setError('')
    setActiveAgentId(CHESS_ANALYSIS_AGENT)
    try {
      const result = await callAIAgent(`Analise esta posicao FEN: ${fen}`, CHESS_ANALYSIS_AGENT)
      const data = result?.response?.result
      if (data) {
        setAnalysis({
          analysis_type: data.analysis_type ?? '',
          position_evaluation: data.position_evaluation ?? '0.0',
          best_moves: Array.isArray(data.best_moves) ? data.best_moves : [],
          strategic_themes: Array.isArray(data.strategic_themes) ? data.strategic_themes : [],
          move_classifications: Array.isArray(data.move_classifications) ? data.move_classifications : [],
          summary: data.summary ?? '',
          material_balance: data.material_balance ?? '',
          key_weaknesses: Array.isArray(data.key_weaknesses) ? data.key_weaknesses : []
        })
        if (fenInput.trim()) {
          setCurrentFen(fenInput.trim())
        }
      } else {
        setError('Sem dados na resposta do agente.')
      }
    } catch (err) {
      setError('Erro ao analisar posicao. Tente novamente.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [fenInput, currentFen])

  const handleNewGame = () => {
    setCurrentFen(INITIAL_FEN)
    setMoveHistory([])
    setAnalysis(null)
    setFenInput('')
    setError('')
  }

  const handleAddMove = () => {
    if (!moveInput.trim()) return
    setMoveHistory(prev => [...prev, moveInput.trim()])
    setMoveInput('')
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Left column - Board */}
      <div className="flex-[3] space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Dificuldade</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-16 h-8 text-sm bg-secondary border-border"
            />
          </div>
          <div className="flex gap-1">
            {(['white', 'black', 'random'] as const).map(c => (
              <Button
                key={c}
                variant={selectedColor === c ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedColor(c)}
                className="text-xs h-8"
              >
                {c === 'white' ? 'Brancas' : c === 'black' ? 'Pretas' : 'Aleatorio'}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleNewGame} className="h-8 gap-2">
            <FiRefreshCw className="w-3 h-3" />
            Nova Partida
          </Button>
        </div>

        <ChessBoard fen={currentFen} />

        <div className="flex gap-2">
          <Input
            placeholder="Lance (ex: e4, Nf3, O-O)"
            value={moveInput}
            onChange={(e) => setMoveInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddMove() }}
            className="bg-secondary border-border"
          />
          <Button onClick={handleAddMove} variant="outline" size="sm">Jogar</Button>
        </div>

        {moveHistory.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Historico de Lances</p>
              <div className="flex flex-wrap gap-1">
                {moveHistory.map((move, i) => (
                  <span key={i} className="text-sm">
                    {i % 2 === 0 ? <span className="text-muted-foreground mr-1">{Math.floor(i / 2) + 1}.</span> : null}
                    <span className="font-medium">{move}</span>
                    {' '}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right column - Analysis */}
      <div className="flex-[2] space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BiAnalyse className="w-4 h-4 text-[hsl(0_70%_55%)]" />
              Analise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Cole uma posicao FEN aqui..."
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              rows={2}
              className="bg-secondary border-border text-sm font-mono"
            />
            <Button
              onClick={analyzePosition}
              disabled={loading}
              className="w-full bg-[hsl(0_70%_55%)] hover:bg-[hsl(0_70%_45%)] text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  Analisando posicao...
                </span>
              ) : 'Analisar Posicao'}
            </Button>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800 text-red-300 text-sm">{error}</div>
            )}
          </CardContent>
        </Card>

        {displayAnalysis && (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4 pr-4">
              {/* Evaluation */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Avaliacao</span>
                    <Badge className={evalColor(displayAnalysis.position_evaluation)}>
                      {displayAnalysis.position_evaluation}
                    </Badge>
                  </div>
                  {displayAnalysis.material_balance && (
                    <p className="text-sm text-muted-foreground">{displayAnalysis.material_balance}</p>
                  )}
                </CardContent>
              </Card>

              {/* Best Moves */}
              {displayAnalysis.best_moves.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Melhores Lances</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {displayAnalysis.best_moves.map((m, i) => (
                      <div key={i} className="flex gap-3">
                        <Badge variant="outline" className="shrink-0 font-mono text-xs">{m.move ?? ''}</Badge>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-1.5 py-0.5 ${evalColor(m.evaluation ?? '')}`}>{m.evaluation ?? ''}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{m.explanation ?? ''}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Themes */}
              {displayAnalysis.strategic_themes.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Temas Estrategicos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {displayAnalysis.strategic_themes.map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Weaknesses */}
              {displayAnalysis.key_weaknesses.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fraquezas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {displayAnalysis.key_weaknesses.map((w, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-[hsl(0_70%_55%)] mt-0.5">--</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Summary */}
              {displayAnalysis.summary && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Resumo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderMarkdown(displayAnalysis.summary)}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        )}

        {!displayAnalysis && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <BiAnalyse className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Cole um FEN e clique em Analisar</p>
            <p className="text-xs mt-1">para ver a avaliacao da posicao</p>
          </div>
        )}

        {activeAgentId && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <div className="w-2 h-2 bg-[hsl(0_70%_55%)] animate-pulse" />
            Agente de Analise processando...
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Aberturas Section ───────────────────────────────────────────────────────

function AberturasSection({ showSample }: { showSample: boolean }) {
  const [isTraining, setIsTraining] = useState(false)
  const [selectedOpening, setSelectedOpening] = useState('')
  const [openingData, setOpeningData] = useState<OpeningData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userInput, setUserInput] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([])
  const [expandedVariation, setExpandedVariation] = useState<number | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const displayOpening = showSample && !openingData && isTraining ? SAMPLE_OPENING : openingData

  const startTraining = async (name: string) => {
    setSelectedOpening(name)
    setIsTraining(true)
    setLoading(true)
    setError('')
    setChatHistory([])
    setActiveAgentId(OPENING_TRAINER_AGENT)
    try {
      const result = await callAIAgent(
        `Inicie o treinamento da abertura: ${name}. Apresente a primeira jogada e explique os conceitos principais.`,
        OPENING_TRAINER_AGENT
      )
      const data = result?.response?.result
      if (data) {
        const parsed: OpeningData = {
          opening_name: data.opening_name ?? name,
          eco_code: data.eco_code ?? '',
          current_position_fen: data.current_position_fen ?? INITIAL_FEN,
          current_move: data.current_move ?? '',
          move_explanation: data.move_explanation ?? '',
          main_line: Array.isArray(data.main_line) ? data.main_line : [],
          key_variations: Array.isArray(data.key_variations) ? data.key_variations : [],
          strategic_plans: Array.isArray(data.strategic_plans) ? data.strategic_plans : [],
          typical_mistakes: Array.isArray(data.typical_mistakes) ? data.typical_mistakes : [],
          next_prompt: data.next_prompt ?? '',
          user_move_feedback: data.user_move_feedback ?? ''
        }
        setOpeningData(parsed)
        setChatHistory([{ role: 'agent', content: data.move_explanation ?? `Treinamento de ${name} iniciado.` }])
      } else {
        setError('Sem resposta do agente.')
      }
    } catch (err) {
      setError('Erro ao iniciar treinamento.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  const sendMove = async () => {
    if (!userInput.trim()) return
    const msg = userInput.trim()
    setChatHistory(prev => [...prev, { role: 'user', content: msg }])
    setUserInput('')
    setLoading(true)
    setError('')
    setActiveAgentId(OPENING_TRAINER_AGENT)
    try {
      const result = await callAIAgent(
        `Estou treinando a abertura ${selectedOpening}. Minha jogada: ${msg}`,
        OPENING_TRAINER_AGENT
      )
      const data = result?.response?.result
      if (data) {
        const parsed: OpeningData = {
          opening_name: data.opening_name ?? selectedOpening,
          eco_code: data.eco_code ?? openingData?.eco_code ?? '',
          current_position_fen: data.current_position_fen ?? openingData?.current_position_fen ?? INITIAL_FEN,
          current_move: data.current_move ?? '',
          move_explanation: data.move_explanation ?? '',
          main_line: Array.isArray(data.main_line) ? data.main_line : openingData?.main_line ?? [],
          key_variations: Array.isArray(data.key_variations) ? data.key_variations : openingData?.key_variations ?? [],
          strategic_plans: Array.isArray(data.strategic_plans) ? data.strategic_plans : openingData?.strategic_plans ?? [],
          typical_mistakes: Array.isArray(data.typical_mistakes) ? data.typical_mistakes : openingData?.typical_mistakes ?? [],
          next_prompt: data.next_prompt ?? '',
          user_move_feedback: data.user_move_feedback ?? ''
        }
        setOpeningData(parsed)
        const feedback = data.user_move_feedback || data.move_explanation || 'Lance registrado.'
        setChatHistory(prev => [...prev, { role: 'agent', content: feedback }])
      }
    } catch (err) {
      setError('Erro ao enviar jogada.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  if (!isTraining) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Catalogo de Aberturas</h2>
          <p className="text-sm text-muted-foreground">Escolha uma abertura para iniciar o treinamento interativo</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {OPENINGS_CATALOG.map((op, i) => (
            <Card key={i} className="bg-card border-border hover:border-[hsl(0_70%_55%)] transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs font-mono">{op.eco}</Badge>
                  <Badge variant="secondary" className="text-xs">{op.difficulty}</Badge>
                </div>
                <CardTitle className="text-lg font-serif tracking-tight">{op.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="outline" className="text-xs">{op.color}</Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">{op.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-[hsl(0_70%_55%)] text-[hsl(0_70%_55%)] hover:bg-[hsl(0_70%_55%)] hover:text-white"
                  onClick={() => startTraining(op.name)}
                >
                  Treinar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Left - Board */}
      <div className="flex-[3] space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setIsTraining(false); setOpeningData(null); setChatHistory([]); setError('') }}
          className="gap-2"
        >
          <FiChevronLeft className="w-4 h-4" />
          Voltar ao Catalogo
        </Button>

        <ChessBoard fen={displayOpening?.current_position_fen ?? INITIAL_FEN} />

        {displayOpening && (
          <div className="space-y-3">
            {/* Main Line */}
            {displayOpening.main_line.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Linha Principal</p>
                  <div className="flex flex-wrap gap-1">
                    {displayOpening.main_line.map((m, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-mono">{m}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Strategic Plans */}
            {displayOpening.strategic_plans.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Planos Estrategicos</p>
                  <ul className="space-y-1">
                    {displayOpening.strategic_plans.map((p, i) => (
                      <li key={i} className="text-xs flex items-start gap-2">
                        <FiChevronRight className="w-3 h-3 mt-0.5 text-[hsl(0_70%_55%)] shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Right - Training Panel */}
      <div className="flex-[2] space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-serif">{displayOpening?.opening_name ?? selectedOpening}</CardTitle>
              {displayOpening?.eco_code && <Badge variant="outline" className="font-mono text-xs">{displayOpening.eco_code}</Badge>}
            </div>
            {displayOpening?.current_move && (
              <CardDescription className="text-sm font-mono mt-1">{displayOpening.current_move}</CardDescription>
            )}
          </CardHeader>
        </Card>

        {/* Chat History */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-3 pr-4">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`p-3 text-sm ${msg.role === 'user' ? 'bg-secondary border border-border ml-4 sm:ml-8' : 'bg-card border border-border mr-2 sm:mr-4'}`}>
                <p className="text-xs text-muted-foreground mb-1">{msg.role === 'user' ? 'Voce' : 'Treinador'}</p>
                {renderMarkdown(msg.content)}
              </div>
            ))}
            {loading && (
              <div className="p-3 bg-card border border-border mr-2 sm:mr-4 text-sm flex items-center gap-2 text-muted-foreground">
                <FiRefreshCw className="w-3 h-3 animate-spin" />
                Analisando...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Key Variations */}
        {displayOpening && displayOpening.key_variations.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Variacoes Principais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {displayOpening.key_variations.map((v, i) => (
                <div key={i} className="border border-border">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-secondary"
                    onClick={() => setExpandedVariation(expandedVariation === i ? null : i)}
                  >
                    <span className="font-medium">{v.variation_name ?? `Variacao ${i + 1}`}</span>
                    {expandedVariation === i ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedVariation === i && (
                    <div className="px-3 pb-3 space-y-1">
                      <p className="text-xs font-mono text-muted-foreground">{v.moves ?? ''}</p>
                      <p className="text-xs">{v.explanation ?? ''}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Typical Mistakes */}
        {displayOpening && displayOpening.typical_mistakes.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HiOutlineLightBulb className="w-4 h-4 text-yellow-500" />
                Erros Tipicos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {displayOpening.typical_mistakes.map((m, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-yellow-500 shrink-0">--</span>
                    {m}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Next Prompt */}
        {displayOpening?.next_prompt && (
          <div className="p-3 bg-secondary border border-border text-sm italic text-muted-foreground">
            {displayOpening.next_prompt}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800 text-red-300 text-sm">{error}</div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Sua jogada ou pergunta..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMove() }}
            className="bg-secondary border-border"
          />
          <Button onClick={sendMove} disabled={loading || !userInput.trim()} className="bg-[hsl(0_70%_55%)] hover:bg-[hsl(0_70%_45%)] text-white shrink-0">
            Proxima Jogada
          </Button>
        </div>

        {activeAgentId && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <div className="w-2 h-2 bg-[hsl(0_70%_55%)] animate-pulse" />
            Agente de Aberturas processando...
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Puzzles Section ─────────────────────────────────────────────────────────

function PuzzlesSection({ showSample }: { showSample: boolean }) {
  const [puzzleData, setPuzzleData] = useState<PuzzleData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [answerInput, setAnswerInput] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('Fork')
  const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate')
  const [hintsRevealed, setHintsRevealed] = useState(0)
  const [showSolution, setShowSolution] = useState(false)
  const [puzzleStats, setPuzzleStats] = useState<PuzzleStats>({ streak: 0, total: 0, correct: 0 })
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const displayPuzzle = showSample && !puzzleData ? SAMPLE_PUZZLE : puzzleData

  const themes = ['Fork', 'Pin', 'Skewer', 'Mate em 2', 'Mate em 3', 'Sacrificio', 'Descoberta']
  const difficulties = [
    { key: 'beginner', label: 'Iniciante' },
    { key: 'intermediate', label: 'Intermediario' },
    { key: 'advanced', label: 'Avancado' },
    { key: 'master', label: 'Mestre' }
  ]

  const getNewPuzzle = async () => {
    setLoading(true)
    setError('')
    setHintsRevealed(0)
    setShowSolution(false)
    setAnswerInput('')
    setActiveAgentId(TACTICS_COACH_AGENT)
    try {
      const result = await callAIAgent(
        `Apresente um puzzle tatico com tema: ${selectedTheme}, dificuldade: ${selectedDifficulty}. Gere uma posicao FEN e o desafio.`,
        TACTICS_COACH_AGENT
      )
      const data = result?.response?.result
      if (data) {
        setPuzzleData({
          puzzle_fen: data.puzzle_fen ?? INITIAL_FEN,
          side_to_move: data.side_to_move ?? 'white',
          difficulty: data.difficulty ?? selectedDifficulty,
          tactical_theme: data.tactical_theme ?? selectedTheme,
          puzzle_prompt: data.puzzle_prompt ?? '',
          solution: Array.isArray(data.solution) ? data.solution : [],
          solution_explanation: data.solution_explanation ?? '',
          hints: Array.isArray(data.hints) ? data.hints : [],
          user_answer_feedback: '',
          is_correct: false,
          pattern_lesson: data.pattern_lesson ?? '',
          next_action: data.next_action ?? 'new_puzzle'
        })
      } else {
        setError('Sem resposta do agente.')
      }
    } catch (err) {
      setError('Erro ao gerar puzzle.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  const submitAnswer = async () => {
    if (!answerInput.trim() || !puzzleData) return
    setLoading(true)
    setError('')
    setActiveAgentId(TACTICS_COACH_AGENT)
    try {
      const result = await callAIAgent(
        `Minha resposta para o puzzle (tema: ${puzzleData.tactical_theme}, FEN: ${puzzleData.puzzle_fen}): ${answerInput.trim()}. Avalie minha resposta.`,
        TACTICS_COACH_AGENT
      )
      const data = result?.response?.result
      if (data) {
        const isCorrect = data.is_correct === true || data.is_correct === 'true'
        setPuzzleData(prev => prev ? {
          ...prev,
          user_answer_feedback: data.user_answer_feedback ?? '',
          is_correct: isCorrect,
          solution_explanation: data.solution_explanation ?? prev.solution_explanation,
          pattern_lesson: data.pattern_lesson ?? prev.pattern_lesson,
          next_action: data.next_action ?? 'new_puzzle'
        } : prev)
        setPuzzleStats(prev => ({
          streak: isCorrect ? prev.streak + 1 : 0,
          total: prev.total + 1,
          correct: isCorrect ? prev.correct + 1 : prev.correct
        }))
      }
    } catch (err) {
      setError('Erro ao verificar resposta.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  const revealHint = () => {
    const hints = displayPuzzle?.hints ?? []
    if (hintsRevealed < hints.length) {
      setHintsRevealed(prev => prev + 1)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Left - Board */}
      <div className="flex-[3] space-y-4">
        {displayPuzzle && (
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-[hsl(0_70%_55%)] text-white">{displayPuzzle.tactical_theme}</Badge>
            <Badge variant="secondary">{difficultyLabel(displayPuzzle.difficulty)}</Badge>
            <Badge variant="outline">
              {displayPuzzle.side_to_move === 'white' ? 'Brancas jogam' : 'Pretas jogam'}
            </Badge>
          </div>
        )}

        <ChessBoard fen={displayPuzzle?.puzzle_fen ?? INITIAL_FEN} />

        {displayPuzzle?.puzzle_prompt && (
          <div className="p-3 bg-card border border-border text-sm font-medium">
            {displayPuzzle.puzzle_prompt}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Sua resposta (ex: Qxf7+)"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitAnswer() }}
            className="bg-secondary border-border"
          />
          <Button onClick={submitAnswer} disabled={loading || !answerInput.trim()} className="bg-[hsl(0_70%_55%)] hover:bg-[hsl(0_70%_45%)] text-white shrink-0">
            Enviar
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={revealHint} disabled={!displayPuzzle || hintsRevealed >= (displayPuzzle?.hints?.length ?? 0)} className="gap-2">
            <HiOutlineLightBulb className="w-4 h-4" />
            Dica
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSolution(true)} disabled={!displayPuzzle}>
            Mostrar Solucao
          </Button>
          <Button variant="outline" size="sm" onClick={getNewPuzzle} disabled={loading} className="gap-2">
            <FiRefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Novo Puzzle
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Sequencia:</span>
            <span className="font-bold text-[hsl(0_70%_55%)]">{puzzleStats.streak}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Acertos:</span>
            <span className="font-bold">{puzzleStats.total > 0 ? Math.round((puzzleStats.correct / puzzleStats.total) * 100) : 0}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total:</span>
            <span>{puzzleStats.total}</span>
          </div>
        </div>
      </div>

      {/* Right - Coach Panel */}
      <div className="flex-[2] space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GiChessKnight className="w-5 h-5 text-[hsl(0_70%_55%)]" />
              Treinador Tatico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Theme Selector */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Tema</p>
              <div className="flex flex-wrap gap-1">
                {themes.map(t => (
                  <Button
                    key={t}
                    variant={selectedTheme === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTheme(t)}
                    className="text-xs h-7"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* Difficulty Selector */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Dificuldade</p>
              <div className="flex flex-wrap gap-1">
                {difficulties.map(d => (
                  <Button
                    key={d.key}
                    variant={selectedDifficulty === d.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDifficulty(d.key)}
                    className="text-xs h-7"
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={getNewPuzzle} disabled={loading} className="w-full bg-[hsl(0_70%_55%)] hover:bg-[hsl(0_70%_45%)] text-white">
              {loading ? (
                <span className="flex items-center gap-2">
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  Gerando puzzle...
                </span>
              ) : 'Novo Puzzle'}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-800 text-red-300 text-sm">{error}</div>
        )}

        {/* Feedback */}
        {displayPuzzle?.user_answer_feedback && (
          <Card className={`border ${displayPuzzle.is_correct ? 'border-green-600 bg-green-900/10' : 'border-orange-600 bg-orange-900/10'}`}>
            <CardContent className="p-4">
              <p className={`text-sm font-medium mb-1 ${displayPuzzle.is_correct ? 'text-green-400' : 'text-orange-400'}`}>
                {displayPuzzle.is_correct ? 'Correto!' : 'Incorreto'}
              </p>
              <p className="text-xs text-muted-foreground">{displayPuzzle.user_answer_feedback}</p>
            </CardContent>
          </Card>
        )}

        {/* Hints */}
        {displayPuzzle && hintsRevealed > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HiOutlineLightBulb className="w-4 h-4 text-yellow-500" />
                Dicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(displayPuzzle.hints ?? []).slice(0, hintsRevealed).map((h, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-yellow-500 font-bold shrink-0">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Solution */}
        {displayPuzzle && showSolution && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Solucao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {(displayPuzzle.solution ?? []).map((s, i) => (
                  <Badge key={i} className="bg-[hsl(0_70%_55%)] text-white font-mono">{s}</Badge>
                ))}
              </div>
              {displayPuzzle.solution_explanation && (
                <div className="text-xs text-muted-foreground">{renderMarkdown(displayPuzzle.solution_explanation)}</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pattern Lesson */}
        {displayPuzzle?.pattern_lesson && (showSolution || displayPuzzle.user_answer_feedback) && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Licao do Padrao</CardTitle>
            </CardHeader>
            <CardContent>
              {renderMarkdown(displayPuzzle.pattern_lesson)}
            </CardContent>
          </Card>
        )}

        {!displayPuzzle && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <FiTarget className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione tema e dificuldade</p>
            <p className="text-xs mt-1">e clique em Novo Puzzle para comecar</p>
          </div>
        )}

        {activeAgentId && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <div className="w-2 h-2 bg-[hsl(0_70%_55%)] animate-pulse" />
            Agente de Taticas processando...
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Revisao Section ─────────────────────────────────────────────────────────

function RevisaoSection({ showSample }: { showSample: boolean }) {
  const [pgnInput, setPgnInput] = useState('')
  const [reviewData, setReviewData] = useState<ChessAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const displayReview = showSample && !reviewData ? SAMPLE_REVIEW : reviewData
  const classifications = Array.isArray(displayReview?.move_classifications) ? displayReview.move_classifications : []
  const selectedMove = selectedMoveIndex !== null && selectedMoveIndex < classifications.length ? classifications[selectedMoveIndex] : null

  const analyzeGame = async () => {
    if (!pgnInput.trim()) return
    setLoading(true)
    setError('')
    setSelectedMoveIndex(null)
    setActiveAgentId(CHESS_ANALYSIS_AGENT)
    try {
      const result = await callAIAgent(
        `Analise esta partida PGN completa, classificando cada lance: ${pgnInput.trim()}`,
        CHESS_ANALYSIS_AGENT
      )
      const data = result?.response?.result
      if (data) {
        setReviewData({
          analysis_type: data.analysis_type ?? 'pgn_analysis',
          position_evaluation: data.position_evaluation ?? '',
          best_moves: Array.isArray(data.best_moves) ? data.best_moves : [],
          strategic_themes: Array.isArray(data.strategic_themes) ? data.strategic_themes : [],
          move_classifications: Array.isArray(data.move_classifications) ? data.move_classifications : [],
          summary: data.summary ?? '',
          material_balance: data.material_balance ?? '',
          key_weaknesses: Array.isArray(data.key_weaknesses) ? data.key_weaknesses : []
        })
      } else {
        setError('Sem dados na resposta do agente.')
      }
    } catch (err) {
      setError('Erro ao analisar partida.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* PGN Input */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FiSearch className="w-4 h-4 text-[hsl(0_70%_55%)]" />
            Revisao de Partida
          </CardTitle>
          <CardDescription>Cole o PGN da sua partida para uma analise detalhada lance a lance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={"1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. Bg5 h6 6. Bh4 g5\n\nCole seu PGN aqui para analise completa..."}
            value={pgnInput}
            onChange={(e) => setPgnInput(e.target.value)}
            rows={5}
            className="bg-secondary border-border font-mono text-sm"
          />
          <Button
            onClick={analyzeGame}
            disabled={loading || !pgnInput.trim()}
            className="w-full bg-[hsl(0_70%_55%)] hover:bg-[hsl(0_70%_45%)] text-white"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <FiRefreshCw className="w-4 h-4 animate-spin" />
                Analisando partida...
              </span>
            ) : 'Analisar Partida'}
          </Button>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 text-red-300 text-sm">{error}</div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {displayReview && classifications.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Move List */}
          <div className="flex-[3]">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Lances da Partida</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 pr-4">
                    {classifications.map((mc, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedMoveIndex(i)}
                        className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 text-sm text-left transition-colors ${selectedMoveIndex === i ? 'bg-secondary border border-[hsl(0_70%_55%)]' : 'hover:bg-secondary border border-transparent'}`}
                      >
                        <span className="font-mono w-14 sm:w-20 shrink-0 text-muted-foreground text-xs sm:text-sm">{mc.move_number ?? ''}</span>
                        <Badge className={`text-xs shrink-0 ${classificationColor(mc.classification ?? '')}`}>
                          {classificationSymbol(mc.classification ?? '')} {classificationLabel(mc.classification ?? '')}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">{mc.comment ?? ''}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Move Detail */}
          <div className="flex-[2] space-y-4">
            {selectedMove ? (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg">{selectedMove.move_number ?? ''}</span>
                    <Badge className={classificationColor(selectedMove.classification ?? '')}>
                      {classificationSymbol(selectedMove.classification ?? '')} {classificationLabel(selectedMove.classification ?? '')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedMove.comment && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Comentario</p>
                      <p className="text-sm">{selectedMove.comment}</p>
                    </div>
                  )}
                  {selectedMove.best_alternative && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Melhor Alternativa</p>
                      <Badge variant="outline" className="font-mono">{selectedMove.best_alternative}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12 text-muted-foreground border border-border">
                <p className="text-sm">Selecione um lance</p>
                <p className="text-xs mt-1">para ver a analise detalhada</p>
              </div>
            )}

            {/* Evaluation */}
            {displayReview.position_evaluation && (
              <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Avaliacao Final</span>
                  <Badge className={evalColor(displayReview.position_evaluation)}>{displayReview.position_evaluation}</Badge>
                </CardContent>
              </Card>
            )}

            {/* Material Balance */}
            {displayReview.material_balance && (
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Balanco Material</p>
                  <p className="text-sm">{displayReview.material_balance}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Summary Section */}
      {displayReview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {displayReview.summary && (
            <Card className="bg-card border-border md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo da Partida</CardTitle>
              </CardHeader>
              <CardContent>
                {renderMarkdown(displayReview.summary)}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {displayReview.strategic_themes.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Temas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {displayReview.strategic_themes.map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {displayReview.key_weaknesses.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pontos Fracos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {displayReview.key_weaknesses.map((w, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-[hsl(0_70%_55%)] shrink-0">--</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {!displayReview && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          <FiSearch className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm">Cole um PGN acima para analise</p>
          <p className="text-xs mt-1">Cada lance sera classificado e analisado individualmente</p>
        </div>
      )}

      {activeAgentId && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <div className="w-2 h-2 bg-[hsl(0_70%_55%)] animate-pulse" />
          Agente de Analise processando partida...
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Page() {
  const [activeSection, setActiveSection] = useState<Section>('jogar')
  const [showSample, setShowSample] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  // PWA install prompt listener
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed === 'true') return

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    try {
      await (installPrompt as any).prompt()
      const result = await (installPrompt as any).userChoice
      if (result?.outcome === 'accepted') {
        setShowInstallBanner(false)
        setInstallPrompt(null)
      }
    } catch {
      // ignore
    }
  }

  const handleDismissInstall = () => {
    setShowInstallBanner(false)
    setInstallPrompt(null)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  const sectionTitles: Record<Section, string> = {
    jogar: 'Jogar',
    aberturas: 'Aberturas',
    puzzles: 'Puzzles',
    revisao: 'Revisao'
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar
          active={activeSection}
          onNavigate={setActiveSection}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="ml-0 md:ml-56 min-h-screen">
          {/* Header */}
          <div className="border-b border-border px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 bg-background z-30">
            <div className="flex items-center gap-3">
              {/* Hamburger menu - mobile only */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors -ml-2"
                aria-label="Abrir menu"
              >
                <FiMenu className="w-5 h-5" />
              </button>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">{sectionTitles[activeSection]}</h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground hidden sm:inline">Sample Data</Label>
              <Switch
                id="sample-toggle"
                checked={showSample}
                onCheckedChange={setShowSample}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 lg:p-8">
            {activeSection === 'jogar' && <JogarSection showSample={showSample} />}
            {activeSection === 'aberturas' && <AberturasSection showSample={showSample} />}
            {activeSection === 'puzzles' && <PuzzlesSection showSample={showSample} />}
            {activeSection === 'revisao' && <RevisaoSection showSample={showSample} />}
          </div>
        </main>

        {/* PWA Install Banner */}
        {showInstallBanner && (
          <PWAInstallBanner
            installPrompt={installPrompt}
            onInstall={handleInstall}
            onDismiss={handleDismissInstall}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
