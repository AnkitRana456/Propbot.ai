import React, { useState } from 'react';
import { X, Home, Plus } from 'lucide-react';
import { useCreateUnit } from '../../services/inventory.service.js';
import type { UnitStatus } from '@propbot/shared';

interface CreateUnitModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateUnitModal: React.FC<CreateUnitModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [unitNumber, setUnitNumber] = useState('');
  const [tower, setTower] = useState('Tower A');
  const [floor, setFloor] = useState('1');
  const [bhk, setBhk] = useState('2');
  const [carpetAreaSqft, setCarpetAreaSqft] = useState('850');
  const [superAreaSqft, setSuperAreaSqft] = useState('1150');
  const [price, setPrice] = useState('8500000');
  const [status, setStatus] = useState<UnitStatus>('available');
  const [facing, setFacing] = useState('North-East');
  const [furnishing, setFurnishing] = useState('Semi-Furnished');

  const createUnitMutation = useCreateUnit();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitNumber.trim() || !bhk || !carpetAreaSqft || !price) return;

    await createUnitMutation.mutateAsync({
      projectId,
      input: {
        unitNumber: unitNumber.trim(),
        tower: tower.trim() || undefined,
        floor: floor ? parseInt(floor, 10) : undefined,
        bhk: parseInt(bhk, 10),
        carpetAreaSqft: parseFloat(carpetAreaSqft),
        superAreaSqft: superAreaSqft ? parseFloat(superAreaSqft) : undefined,
        price: parseFloat(price),
        status,
        facing: facing.trim() || undefined,
        furnishing: furnishing.trim() || undefined,
      },
    });

    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-subtle/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-subtle text-primary">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Add Unit</h3>
              <p className="text-xs text-text-subtle">Register a new unit in this inventory project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Unit Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 402 or B-1204"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Tower / Wing
              </label>
              <input
                type="text"
                placeholder="e.g. Tower A"
                value={tower}
                onChange={(e) => setTower(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                BHK *
              </label>
              <select
                value={bhk}
                onChange={(e) => setBhk(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              >
                <option value="1">1 BHK</option>
                <option value="2">2 BHK</option>
                <option value="3">3 BHK</option>
                <option value="4">4 BHK</option>
                <option value="5">5+ BHK</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Floor
              </label>
              <input
                type="number"
                placeholder="e.g. 4"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UnitStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              >
                <option value="available">Available</option>
                <option value="hold">Hold</option>
                <option value="booked">Booked</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Carpet Area (sq.ft) *
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 850"
                value={carpetAreaSqft}
                onChange={(e) => setCarpetAreaSqft(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Super Area (sq.ft)
              </label>
              <input
                type="number"
                placeholder="e.g. 1150"
                value={superAreaSqft}
                onChange={(e) => setSuperAreaSqft(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
              Unit Price (₹) *
            </label>
            <input
              type="number"
              required
              placeholder="e.g. 8500000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
            />
            <p className="text-xs text-text-muted mt-1">
              {price && !isNaN(Number(price)) ? `Equivalent to: ₹${(Number(price) / 10000000 >= 1 ? `${(Number(price) / 10000000).toFixed(2)} Cr` : `${(Number(price) / 100000).toFixed(2)} Lakhs`)}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Facing
              </label>
              <input
                type="text"
                placeholder="e.g. East, North-East"
                value={facing}
                onChange={(e) => setFacing(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Furnishing
              </label>
              <select
                value={furnishing}
                onChange={(e) => setFurnishing(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-text"
              >
                <option value="Unfurnished">Unfurnished</option>
                <option value="Semi-Furnished">Semi-Furnished</option>
                <option value="Fully-Furnished">Fully-Furnished</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createUnitMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {createUnitMutation.isPending ? 'Saving...' : 'Add Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
