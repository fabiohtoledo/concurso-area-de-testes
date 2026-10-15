import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://mhuknxaoeozoxqkwzqcb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odWtueGFvZW96b3hxa3d6cWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MjE3MDUsImV4cCI6MjEwNzM5NzcwNX0.pvSpGvpEtiMaKQoxwMPYB-O3epKbrnzdNMRnTKAmIfw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function protegerPagina() {
    // 1. Pega a sessão atual do Supabase Auth
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
        console.warn("Acesso negado. Redirecionando para o login...")
        window.location.replace('login.html')
        return
    }

    // 2. Busca os dados do perfil pelo ID do usuário autenticado
    const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('status_assinatura, expires_at, current_session_id')
        .eq('id', session.user.id)
        .single()

    if (perfilError || !perfil) {
        alert("Erro ao carregar dados do perfil.")
        await supabase.auth.signOut()
        window.location.replace('login.html')
        return
    }

    // 3. Validação de Assinatura e Data de Expiração
    const hoje = new Date()
    const dataExpiracao = perfil.expires_at ? new Date(perfil.expires_at) : null

    if (perfil.status_assinatura !== 'ativo' || (dataExpiracao && hoje > dataExpiracao)) {
        alert("Sua assinatura está expirada ou inativa.")
        await supabase.auth.signOut()
        window.location.replace('login.html')
        return
    }

    // 4. Validação de Sessão Única (Garante que se tiver sessão gravada, bate com a atual)
    const tokenLocalSalvo = localStorage.getItem('meu_app_session_token') || session.access_token

    // Atualiza o localStorage se ainda não estiver salvo no navegador
    if (!localStorage.getItem('meu_app_session_token')) {
        localStorage.setItem('meu_app_session_token', session.access_token)
    }

    // Se no banco existir um token gravado e for diferente do token da sessão atual
    if (perfil.current_session_id && perfil.current_session_id !== session.access_token) {
        alert("Sua conta foi acessada em outro dispositivo ou navegador.")
        await supabase.auth.signOut()
        localStorage.removeItem('meu_app_session_token')
        window.location.replace('login.html')
        return
    }

    // 5. Libera a visualização da tela se tudo estiver OK
    document.body.style.visibility = 'visible'
    document.body.style.opacity = '1'
}

protegerPagina()

window.fazerLogout = async function() {
    localStorage.removeItem('meu_app_session_token')
    await supabase.auth.signOut()
    window.location.replace('login.html')
}