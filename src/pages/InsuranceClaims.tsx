import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import InsuranceClaimsComponent from "@/components/InsuranceClaims";

const InsuranceClaimsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reception")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insurance Claims</h1>
            <p className="text-sm text-gray-500">Manage insurance billing and provider approvals</p>
          </div>
        </div>
      </div>

      <InsuranceClaimsComponent embedded={true} />
    </div>
  );
};

export default InsuranceClaimsPage;
