import React from 'react';
import { X, Building2, Check, ShieldCheck, MapPin } from 'lucide-react';
import type { ProjectItem } from '@propbot/shared';

interface PropertyCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: ProjectItem[];
}

export const PropertyCompareModal: React.FC<PropertyCompareModalProps> = ({
  isOpen,
  onClose,
  properties,
}) => {
  if (!isOpen || properties.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Side-by-Side Property Comparison
            </h2>
            <p className="text-xs text-slate-500">
              Comparing {properties.length} residential developments across price, area, and specifications
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Comparison Grid */}
        <div className="overflow-x-auto p-5">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="p-3 w-44 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Property Overview
                </th>
                {properties.map(p => (
                  <th key={p.id} className="p-3 min-w-[200px] align-top">
                    <div className="space-y-2">
                      <div className="h-28 w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {p.gallery?.[0] ? (
                          <img src={p.gallery[0]} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">
                            <Building2 className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{p.name}</h4>
                        <p className="text-[11px] text-slate-500">{p.builderName}</p>
                        <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{p.location}</span>
                        </p>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {/* Starting Price */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">Starting Price</td>
                {properties.map(p => (
                  <td key={p.id} className="p-3 font-black text-slate-900 dark:text-white text-sm">
                    {p.pricingDetails?.startingPrice
                      ? `₹${(p.pricingDetails.startingPrice / 10000000).toFixed(2)} Cr`
                      : 'On Request'}
                  </td>
                ))}
              </tr>

              {/* Price per Sq.ft */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">Rate / Sq.ft</td>
                {properties.map(p => (
                  <td key={p.id} className="p-3 font-medium text-slate-700 dark:text-slate-300">
                    {p.pricingDetails?.pricePerSqft ? `₹${p.pricingDetails.pricePerSqft.toLocaleString('en-IN')}` : '₹9,500 – ₹14,000'}
                  </td>
                ))}
              </tr>

              {/* BHK Options */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">Configurations</td>
                {properties.map(p => {
                  const bhks = Array.from(new Set(p.floorPlans?.map(f => f.bhk) || []));
                  return (
                    <td key={p.id} className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {bhks.length > 0 ? (
                          bhks.map(b => (
                            <span
                              key={b}
                              className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            >
                              {b} BHK
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">2, 3, 4 BHK</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* Possession Date */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">Possession</td>
                {properties.map(p => (
                  <td key={p.id} className="p-3 font-medium text-slate-700 dark:text-slate-300">
                    {p.possessionDate || 'Immediate (Ready to Move)'}
                  </td>
                ))}
              </tr>

              {/* RERA Number */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">RERA Registration</td>
                {properties.map(p => (
                  <td key={p.id} className="p-3 text-[11px] text-slate-600 dark:text-slate-400">
                    {p.reraNo ? (
                      <span className="flex items-center gap-1 font-mono">
                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                        {p.reraNo}
                      </span>
                    ) : (
                      'RERA Registered'
                    )}
                  </td>
                ))}
              </tr>

              {/* Status */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">Status</td>
                {properties.map(p => (
                  <td key={p.id} className="p-3 capitalize font-medium text-slate-700 dark:text-slate-300">
                    {p.status.replace('_', ' ')}
                  </td>
                ))}
              </tr>

              {/* Key Amenities */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">Amenities ({properties.reduce((max, p) => Math.max(max, p.amenities?.length || 0), 0)}+)</td>
                {properties.map(p => (
                  <td key={p.id} className="p-3">
                    <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {(p.amenities || []).slice(0, 4).map((amenity, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{amenity}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>

              {/* USPs */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">Key Advantages</td>
                {properties.map(p => (
                  <td key={p.id} className="p-3 text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="space-y-1">
                      {(p.usps || []).slice(0, 2).map((usp, idx) => (
                        <div key={idx} className="font-semibold text-blue-600 dark:text-blue-400">
                          • {usp}
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer dark:bg-white dark:text-slate-900"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
