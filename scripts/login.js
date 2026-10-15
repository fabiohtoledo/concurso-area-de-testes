// Importa o cliente do Supabase direto da CDN oficial
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://mhuknxaoeozoxqkwzqcb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odWtueGFvZW96b3hxa3d6cWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MjE3MDUsImV4cCI6MjEwNzM5NzcwNX0.pvSpGvpEtiMaKQoxwMPYB-O3epKbrnzdNMRnTKAmIfw'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 1. Lógica de Login
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const feedback = document.getElementById('feedback-message');

    feedback.className = "message-box success";
    feedback.textContent = "Validando credenciais...";

    // Tenta autenticar o usuário usando o Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    
    // Se der erro no login, exibe a mensagem na tela e para
    if (error) {
        feedback.className = "message-box error";
        feedback.textContent = "Erro ao entrar: " + error.message;
        return;
    }

    // Se o login deu certo
    if (data && data.session) {
        const sessionIdUnica = data.session.access_token;

        // Salva o token da sessão atual no profile do usuário no banco
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ current_session_id: sessionIdUnica })
            .eq('email', email);

        if (updateError) {
            console.error("Erro ao registrar session_id:", updateError);
        }

        // Salva também no localStorage para conferência do getdumb.js
        localStorage.setItem('meu_app_session_token', sessionIdUnica);

        feedback.className = "message-box success";
        feedback.textContent = "Login bem-sucedido! Redirecionando...";

        // Redireciona para a dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 800);
    }
});

// 2. Redefinição de Senha
document.getElementById('btn-reset-password').addEventListener('click', async function(e) {
    e.preventDefault();
    const emailInput = document.getElementById('email').value;
    const feedback = document.getElementById('feedback-message');

    if (!emailInput) {
        feedback.className = "message-box error";
        feedback.textContent = "Por favor, digite seu e-mail acima primeiro para redefinir/criar a senha.";
        return;
    }

    feedback.className = "message-box success";
    feedback.textContent = "Enviando link de criação/redefinição...";

    const { data, error } = await supabase.auth.resetPasswordForEmail(emailInput, {
        redirectTo: 'https://fabiohtoledo.github.io/concurso-area-de-testes/recovery.html',
    });

    if (error) {
        feedback.className = "message-box error";
        feedback.textContent = "Erro ao enviar e-mail: " + error.message;
        return;
    }

    feedback.className = "message-box success";
    feedback.textContent = "Link enviado para " + emailInput + ". Verifique sua caixa de entrada!";
});