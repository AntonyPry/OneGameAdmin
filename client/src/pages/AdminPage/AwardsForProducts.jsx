import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AwardsForProducts = ({ modalOpen, setModalOpen }) => {
  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Как начисляется премия</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm mt-4">
          <p>
            Если план выполнен, вы получаете{' '}
            <strong>10% от стоимости всех проданных товаров</strong>.
          </p>
          <p>
            <strong>С понедельника по четверг</strong> — если сумма продаж
            превышает <strong>10 000 ₽</strong>, премия{' '}
            <strong>удваивается</strong>.
          </p>
          <h3 className="text-base font-semibold mt-6">Примеры расчёта:</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>План по продаже еды — 6500 ₽</li>
            <li>
              Продано еды на 6400 ₽ — <strong>премия 0 ₽</strong>
            </li>
            <li>
              Продано еды на 7000 ₽ — <strong>премия 700 ₽</strong>
            </li>
            <li>
              Продано еды на 11000 ₽ (в пн-чт) — <strong>премия 2200 ₽</strong>
            </li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AwardsForProducts;
