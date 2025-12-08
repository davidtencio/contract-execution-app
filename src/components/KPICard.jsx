
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export function KPICard({ title, value, subtext, trend, type = 'neutral', icon: Icon }) {
    const getTrendColor = () => {
        if (trend > 0) return 'text-green-500';
        if (trend < 0) return 'text-red-500';
        return 'text-muted-foreground';
    };

    return (
        <div className="card">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                    {Icon ? <Icon className="w-5 h-5 text-primary" /> : <Activity className="w-5 h-5 text-primary" />}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center text-xs font-medium ${getTrendColor()} bg-background/50 px-2 py-1 rounded-full`}>
                        {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>

            <h3 className="text-muted-foreground text-sm font-medium mb-1">{title}</h3>
            <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
            <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>
    );
}
