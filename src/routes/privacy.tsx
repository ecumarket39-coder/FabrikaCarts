import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">152-ФЗ</p>
        <h1 className="font-display text-3xl tracking-tight">Политика персональных данных</h1>
        <div className="space-y-4 text-sm leading-relaxed text-muted">
          <p>
            Оператор обрабатывает адрес электронной почты, имя, загруженные фото товаров, тексты карточек, идентификаторы платежей. Данные нужны, чтобы вести аккаунт, начислять кредиты и оказывать услугу.
          </p>
          <p>
            Правовые основания: договор-оферта и согласие при регистрации. Данные не продаются. Платёжные реквизиты карты оператор не хранит — их принимает ЮKassa.
          </p>
          <p>
            Срок: пока аккаунт активен, затем 3 года для бухгалтерии платежей. Вы можете запросить выгрузку или удаление аккаунта — карточки и баланс будут стёрты, записи оплат сохранятся в объёме, который требует закон.
          </p>
          <p>
            Хранение: база приложения (Postgres) и объектные URL сгенерированных изображений. Передача: ЮKassa (идентификатор заказа, сумма, email для чека), xAI (фото и текст запроса для генерации).
          </p>
          <p>Контакты оператора появятся в реквизитах ЮKassa. До этого — форма входа в цех и почта, указанная в аккаунте.</p>
        </div>
      </main>
    </Shell>
  );
}
