import { supabase } from './getdumb.js'

async function carregarDadosDashboard() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const userId = session.user.id
    const userEmail = session.user.email

    // 1. Busca os dados do perfil (Nome e Validade)
    const { data: perfil } = await supabase
        .from('profiles')
        .select('name, expires_at')
        .eq('email', userEmail)
        .single()

    if (perfil) {
        document.getElementById('userName').textContent = perfil.name || "Aluno"
        document.getElementById('userEmail').textContent = userEmail
        document.getElementById('subscriptionStatus').textContent = "Assinatura Ativa"
        
        if (perfil.expires_at) {
            const partesData = perfil.expires_at.split('T')[0].split('-')
            document.getElementById('subscriptionExpireDate').textContent = `${partesData[2]}/${partesData[1]}/${partesData[0]}`
        }
    }

    // 2. Busca as Estatísticas de Desempenho
    await carregarEstatisticas(userId)
}

async function carregarEstatisticas(userId) {
    const materias = [
        { chave: 'portugues', idFeitas: 'qFeitasPor', idPorc: 'porcPor' },
        { chave: 'matematica', idFeitas: 'qFeitasMat', idPorc: 'porcMat' },
        { chave: 'gerais', idFeitas: 'qFeitasGer', idPorc: 'porcGer' },
        { chave: 'informatica', idFeitas: 'qFeitasInf', idPorc: 'porcInf' },
        { chave: 'administracao', idFeitas: 'qFeitasAdm', idPorc: 'porcAdm' }
    ]

    for (let mat of materias) {
        const { data: historicoMateria } = await supabase
            .from('historico_respostas')
            .select(`
                acertou,
                created_at,
                questoes!inner (materia)
            `)
            .eq('user_id', userId)
            .eq('questoes.materia', mat.chave)
            .order('created_at', { ascending: false })

        const totalFeitas = historicoMateria ? historicoMateria.length : 0

        // Atualiza questões feitas
        const elFeitas = document.getElementById(mat.idFeitas)
        if (elFeitas) {
            elFeitas.querySelector('strong').textContent = totalFeitas
        }

        // Calcula % nas últimas 20
        const elPorc = document.getElementById(mat.idPorc)
        if (elPorc) {
            const ultimas20 = historicoMateria ? historicoMateria.slice(0, 20) : []
            const strongPorc = elPorc.querySelector('strong')
            
            if (ultimas20.length > 0) {
                const totalAcertos = ultimas20.filter(item => item.acertou === true).length
                const porcentagem = Math.round((totalAcertos / ultimas20.length) * 100)
                
                strongPorc.textContent = `${porcentagem}%`
                
                if (porcentagem >= 70) {
                    strongPorc.style.color = 'var(--success-color, #16a34a)'
                } else if (porcentagem < 50) {
                    strongPorc.style.color = 'var(--error-color, #dc2626)'
                } else {
                    strongPorc.style.color = 'var(--text-main, #333)'
                }
            } else {
                strongPorc.textContent = '-'
            }
        }
    }
}

// Executa o carregamento específico da dash
carregarDadosDashboard()