import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const Standarts_for_admins = ({ modalOpen, setModalOpen }) => {
  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Стандарты для администратора</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm mt-4 pb-4">
          <p>
            Здесь мы подробно рассмотрим 3 самых важных пункта в вашей работе и
            за счёт чего вы будете получать либо <strong>1700/1900</strong>,
            либо <strong>1200/1400</strong>:
          </p>
          <ul className="list-disc pl-5">
            <li>Принятие смены</li>
            <li>Ведение смены</li>
            <li>Закрытие смены</li>
          </ul>

          <hr className="my-4" />

          <h2 className="text-lg font-bold">Принятие смены</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>Приход:</strong>
              <br />
              Приходите в <strong>8:30/20:30</strong>, чтобы принять/сдать смену
              и заступить к <strong>9:00/21:00</strong>.
            </li>
            <li>
              <strong>Обратите внимание:</strong>
              <br />
              Вы можете не принимать смену, пока сменщик не выполнит свои
              обязательства.
            </li>
            <li>
              <strong>Пересчёт кассы:</strong>
              <br />
              Очень важно пересчитывать всю кассу. Если окажется, что денег не
              хватает, а вы уже приняли смену — недостача ляжет на вас!
            </li>
            <li>
              <strong>Работа в команде:</strong>
              <br />
              Вы со сменщиком не враги, а <strong>коллеги</strong>. Помогайте
              друг другу, распределяйте обязанности (например: ночник протирает
              весь стандарт, дневник — весь буткемп, вип-залы и плойки) и не
              перекладывайте вину на сменщика.
              <br />
              <strong>Вы приняли смену — теперь вы отвечаете за неё.</strong>
            </li>
            <li>
              <strong>Холодильники:</strong>
              <br />
              Холодильники должны быть заполнены.
            </li>
          </ol>

          <hr className="my-4" />

          <h2 className="text-lg font-bold">Ведение смены</h2>
          <ol className="list-decimal pl-5 space-y-4">
            <li>
              <strong>Чистота в зале:</strong>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Обходите зал минимум раз в полчаса.</li>
                <li>
                  Если кто-то сидит со своими вещами — взимайте пробковый сбор и
                  поправляйте порядок сразу после ухода гостя.
                </li>
                <li>
                  Поправляйте мониторы, клавиатуры, мышки, регулируйте стулья.
                </li>
                <li>
                  Если гость оставил упаковку (банку от энергетика, фантик) —
                  убирайте её.
                </li>
                <li>
                  При пролитой жидкости или оставленных вещах — убирайте
                  немедленно (например, собирайте вещи в коробку «потеряшки»).
                </li>
              </ul>
            </li>
            <li>
              <strong>Чистота на кухне:</strong>
              <br />
              После приготовления френч-дога:
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Убирайте соусы обратно в отсек под грилем.</li>
                <li>Если соус разлит — вытирайте.</li>
                <li>
                  Если кусочек хлеба прилип к грилю — аккуратно стряхните, чтобы
                  не остался запах.
                </li>
              </ul>
            </li>
            <li>
              <strong>Ответы в мессенджерах:</strong>
              <br />
              Отвечайте в ВКонтакте как можно быстрее. Не держите сообщения без
              ответа более получаса (если нет форс-мажора).
            </li>
            <li>
              <strong>Ответы по телефону:</strong>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Если пропущен звонок — обязательно перезвоните.</li>
                <li>
                  Пример приветствия:
                  <blockquote className="border-l-2 border-slate-300 pl-3 mt-1 text-slate-600">
                    «Здравствуйте, компьютерный клуб «One Game», слушаю.»
                  </blockquote>
                </li>
              </ul>
            </li>
          </ol>

          <hr className="my-4" />

          <h2 className="text-lg font-bold">Закрытие смены</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>Чистота:</strong>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>
                  Всё должно быть аккуратно: стулья, коврики, мышки, клавиатуры
                  и мониторы — приведены в порядок.
                </li>
                <li>
                  В зоне PS не должно лежать мусора или геймпадов, если там
                  никого нет.
                </li>
                <li>Лучше лишний раз поправить пуфики.</li>
              </ul>
            </li>
            <li>
              <strong>Сбор мусора:</strong>
              <br />
              Соберите мусор из всех корзин (коридор, общий зал, буткемп,
              вип-зоны, админская стойка, улица).
            </li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Standarts_for_admins;
