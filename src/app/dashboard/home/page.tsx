'use client'
import Button from "@/app/components/button";

const Dashboard = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold">Your Documents</h1>
      <p className="py-5">Recent Documents and Quick Actions</p>

      <main className="py-5">
        <div className="flex flex-col gap-5">
          <div className="flex justify-between max-w-3xl rounded-md border border-gray-200 p-5">
            <div>
              <h2 className="text-lg font-semibold">Upload a Document</h2>
              <p className="text-sm">Choose a file to upload from your computer.</p>
            </div>
            <Button
              buttonTitle="Upload"
              onClick={() => console.log("Upload clicked")}
              className="bg-black px-5 py-2 rounded-lg text-white cursor-pointer"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
