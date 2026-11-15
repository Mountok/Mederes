import { Link } from 'react-router-dom'

export const operator = {
  name: 'Дашуев Ислам Алиханович',
  inn: '201505206040',
  phone: '+7 995 995-73-73',
  phoneHref: 'tel:+79959957373',
  email: 'dashuev@internet.ru',
}

export default function PublicFooter() {
  return <footer className="public-footer">
    <div className="public-footer-inner">
      <div className="public-footer-identity"><strong>Al-Qalam</strong><span>Дашуев Ислам Алиханович · ИНН 201505206040</span></div>
      <nav aria-label="Документы и контакты"><Link to="/legal">Контакты и реквизиты</Link><Link to="/privacy">Обработка данных</Link><Link to="/terms">Условия использования</Link><Link to="/consent">Согласие на обработку данных</Link></nav>
      <div className="public-footer-contacts"><a href={operator.phoneHref}>{operator.phone}</a><a href={`mailto:${operator.email}`}>{operator.email}</a></div>
    </div>
  </footer>
}
