import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import HomeView     from '../views/HomeView.vue'
import LoggedView   from '../views/LoggedView.vue'
import RegisterView from '../views/RegisterView.vue'
import GameView     from '../views/GameView.vue'

const routes = [
  { path: '/',         component: HomeView },
  { path: '/logged',   component: LoggedView,   meta: { requiresAuth: true } },
  { path: '/register', component: RegisterView },
  { path: '/game',     component: GameView,      meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const auth = useAuthStore()
    if (!auth.isLoggedIn) return '/'
  }
})

export default router